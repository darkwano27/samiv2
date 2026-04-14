# Despliegue SAMI v2 en producción — `solucionesti2.aris.com.pe`

Guía paso a paso para **Rocky Linux** en el servidor **172.16.40.25**, con DNS interno apuntando a ese host y **HTTPS con certificados propios** (PWA habilitada vía `vite-plugin-pwa`).

**Receta lineal GitHub + instalar PostgreSQL/Redis + primer clone:** [`primer-deploy-github-postgresql-rocky.md`](./primer-deploy-github-postgresql-rocky.md).

---

## 1. Stack del proyecto (referencia)

| Componente | Versión / notas |
|------------|------------------|
| **Node.js** | 20 LTS (recomendado) |
| **pnpm** | **9.15.9** (`packageManager` en la raíz del monorepo) |
| **Backend** | NestJS 11, prefijo global de API: `/api` |
| **Frontend** | Vite + React 19, build estático en `apps/frontend/dist` |
| **PWA** | `vite-plugin-pwa` (`registerType: 'autoUpdate'`, manifest en build) |
| **BD app** | PostgreSQL (Drizzle + `pnpm db:migrate` en `apps/backend`) |
| **SAP lectura** | PostgreSQL solo lectura (`SAP_DATABASE_URL`) |
| **Sesiones / RBAC cache** | Redis (`REDIS_URL`) |

Health check: `GET https://solucionesti2.aris.com.pe/api/health` → `{ "status": "ok", "timestamp": "..." }`.

---

## 2. DNS y red

- Registro **A** (o CNAME interno): **`solucionesti2.aris.com.pe` → `172.16.40.25`**.
- Desde una PC de prueba: `ping solucionesti2.aris.com.pe` debe resolver a `172.16.40.25`.
- **PWA e instalación “como app”**: el navegador exige **HTTPS** y un certificado **confiable para los clientes** (CA corporativa instalada en las PCs, o certificado válido para ese nombre). Los archivos que tengas suelen ser **certificado + cadena (full chain) + clave privada**.

---

## 3. Servidor Rocky — paquetes base

```bash
sudo dnf update -y
sudo dnf install -y git curl wget nano htop
```

### Node.js 20 y herramientas

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node -v   # v20.x
```

```bash
sudo npm install -g pnpm@9.15.9 pm2
pnpm -v
pm2 -v
```

### Nginx

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx --now
```

### Firewall (si usás firewalld)

```bash
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload
```

### SELinux (si está enforcing y el proxy falla)

```bash
sudo setsebool -P httpd_can_network_connect 1
```

---

## 4. Usuario de despliegue y directorios

```bash
sudo useradd -m -s /bin/bash sami 2>/dev/null || true
sudo mkdir -p /opt/sami-v2 /var/www/sami /opt/sami-v2/logs /opt/sami-v2/exports/he
sudo chown -R sami:sami /opt/sami-v2 /var/www/sami
```

Si más adelante usás **GitHub**, conviene generar una SSH key para el usuario `sami` y registrarla en GitHub (despliegues con `git pull`). **No es obligatorio** tener GitHub para el primer deploy.

---

## 5. Poner el código en el servidor

Git **no crea** la base de datos PostgreSQL. La BD (vacía o no) y el usuario SQL los crea **alguien con acceso a Postgres** (vos o el DBA); después `pnpm db:migrate` solo **crea/actualiza tablas** dentro de esa BD ya existente.

### 5.1 Crear la base de datos SAMI (una vez, en PostgreSQL)

En el servidor donde corre Postgres (o desde cualquier cliente con permisos), como superusuario:

```sql
CREATE DATABASE sami_app;
CREATE USER sami_user WITH PASSWORD 'PASSWORD_SEGURO';
GRANT ALL PRIVILEGES ON DATABASE sami_app TO sami_user;
\c sami_app
GRANT ALL ON SCHEMA public TO sami_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sami_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sami_user;
```

En `apps/backend/.env` usá esa BD en `DATABASE_URL`, por ejemplo:

`postgresql://sami_user:PASSWORD_SEGURO@HOST:5432/sami_app`

Luego, en el deploy: **`pnpm db:migrate`** aplica las migraciones Drizzle (tablas `drizzle.__drizzle_migrations`, etc.). Los comandos **`seed`** y **`seed:rbac`** insertan datos iniciales; **no** sustituyen crear la BD.

### 5.2 Opción A — Repositorio en GitHub (recomendado a medio plazo)

En tu PC (donde está el proyecto):

```bash
cd ruta/al/sami-v2
git init
git add .
git commit -m "chore: initial import"
# Crear repo vacío en GitHub (sin README) y luego:
git remote add origin git@github.com:TU_ORG/sami-v2.git
git branch -M main
git push -u origin main
```

En el servidor, como `sami`:

```bash
su - sami
cd /opt/sami-v2
git clone git@github.com:TU_ORG/sami-v2.git .
pnpm install --frozen-lockfile
```

### 5.3 Opción B — Sin GitHub (primer deploy por copia)

Desde tu PC **Windows** (PowerShell en la carpeta del monorepo), generar un archivo y subirlo:

```powershell
# En la raíz del proyecto sami-v2 (donde está pnpm-workspace.yaml)
Compress-Archive -Path apps,packages,pnpm-workspace.yaml,package.json,pnpm-lock.yaml,turbo.json -DestinationPath sami-v2-deploy.zip
```

Copiá `sami-v2-deploy.zip` al servidor (`scp`, WinSCP, carpeta compartida, etc.). En el servidor (instalá `unzip` si falta: `sudo dnf install -y unzip`):

```bash
su - sami
cd /opt/sami-v2
unzip -q ~/sami-v2-deploy.zip -d .
pnpm install --frozen-lockfile
```

Asegurate de incluir **`pnpm-lock.yaml`** para poder usar `pnpm install --frozen-lockfile` igual que en Git.

### 5.4 Opción C — Solo Git local en el servidor

puedes `git init` dentro de `/opt/sami-v2` y hacer `git pull` desde un remoto interno (GitLab Gitea, etc.) con la misma idea que la opción A.

---

## 6. Variables de entorno — backend

Archivo: `/opt/sami-v2/apps/backend/.env` (permisos `600`).

Valores **obligatorios** según `apps/backend/src/core/config/env.validation.ts`:

- `DATABASE_URL` — PostgreSQL SAMI (lectura/escritura), formato URL.
- `SAP_DATABASE_URL` — réplica / staging SAP (solo lectura).
- `REDIS_URL` — ej. `redis://127.0.0.1:6379` o `redis://:PASSWORD@host:6379`.
- `SESSION_SECRET` — **mínimo 32 caracteres** (ej. `openssl rand -hex 32`).
- `SESSION_TTL` — ej. `86400000`.
- `LDAP_URL`, `LDAP_BASE_DN`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`.
- `NODE_ENV=production`, `PORT=3000`.

Recomendado para SMTP/credenciales en UI (módulos):

- `SETTINGS_ENCRYPTION_KEY` — clave estable en prod (ej. `openssl rand -hex 32`). **Misma clave siempre** en ese entorno o no podrás descifrar lo guardado.

Opcionales según uso: `EMAIL_ENABLED`, `SMTP_*`, `O365_*` (SharePoint), `THROTTLER_*`.

```bash
chmod 600 /opt/sami-v2/apps/backend/.env
```

### Frontend — producción

El cliente HTTP usa **`/api` en el mismo origen** (`apps/frontend/src/infrastructure/http/client.ts`). Con Nginx sirviendo el sitio y haciendo proxy de `/api` al backend, **no hace falta** `VITE_API_BASE_URL` para ese diseño.

Archivo opcional: `/opt/sami-v2/apps/frontend/.env.production`:

```env
VITE_RBAC_ENABLED=true
```

```bash
chmod 600 /opt/sami-v2/apps/frontend/.env.production
```

---

## 7. Certificados TLS (los tuyos)

Creá un directorio solo lectura para nginx, por ejemplo:

```bash
sudo mkdir -p /etc/nginx/ssl/sami
sudo cp fullchain.pem   /etc/nginx/ssl/sami/solucionesti2.fullchain.pem
sudo cp privkey.pem     /etc/nginx/ssl/sami/solucionesti2.key
sudo chown root:root /etc/nginx/ssl/sami/*
sudo chmod 640 /etc/nginx/ssl/sami/solucionesti2.key
sudo chmod 644 /etc/nginx/ssl/sami/solucionesti2.fullchain.pem
```

Ajustá nombres si tu CA entregó `.crt` / `.pem` distintos; lo importante es **cadena completa** en el `.pem` del certificado y la **clave privada** en el `.key`.

---

## 8. Nginx — `solucionesti2.aris.com.pe`

Archivo: `/etc/nginx/conf.d/sami-solucionesti2.conf`

```nginx
# HTTP opcional: redirigir todo a HTTPS
server {
    listen 80;
    server_name solucionesti2.aris.com.pe;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name solucionesti2.aris.com.pe;

    ssl_certificate     /etc/nginx/ssl/sami/solucionesti2.fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/sami/solucionesti2.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    root /var/www/sami;
    index index.html;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
        proxy_pass_header Set-Cookie;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        client_max_body_size 15M;
    }

    # PWA / service worker: no cachear agresivamente el SW ni el HTML
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 7d;
        add_header Cache-Control "public";
    }

    access_log /var/log/nginx/sami-solucionesti2-access.log;
    error_log  /var/log/nginx/sami-solucionesti2-error.log;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 9. PM2 — backend

Archivo `/opt/sami-v2/ecosystem.config.cjs` (propiedad `sami:sami`):

```js
module.exports = {
  apps: [
    {
      name: 'sami-backend',
      cwd: '/opt/sami-v2/apps/backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      error_file: '/opt/sami-v2/logs/backend-error.log',
      out_file: '/opt/sami-v2/logs/backend-out.log',
      merge_logs: true,
      max_memory_restart: '800M',
      watch: false,
    },
  ],
};
```

---

## 10. Primer despliegue (orden exacto)

Como usuario `sami`:

```bash
cd /opt/sami-v2

pnpm install --frozen-lockfile

pnpm --filter @sami/backend build
pnpm --filter @sami/backend db:migrate
pnpm --filter @sami/backend run seed
pnpm --filter @sami/backend run seed:rbac
pnpm --filter @sami/backend run seed:so-catalog

pnpm --filter @sami/frontend build

rm -rf /var/www/sami/*
cp -r apps/frontend/dist/* /var/www/sami/

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u sami --hp /home/sami
# Ejecutar el comando que imprime PM2 con sudo
```

Comprobaciones:

```bash
curl -s http://127.0.0.1:3000/api/health
curl -sk https://solucionesti2.aris.com.pe/api/health
```

Navegador: `https://solucionesti2.aris.com.pe` → login.  
**PWA**: en Chrome/Edge, menú “Instalar aplicación” / icono en la barra de direcciones (requiere HTTPS válido para el cliente).

---

## 11. Actualizaciones posteriores

```bash
su - sami
cd /opt/sami-v2
git pull origin main   # o el branch/tag acordado

pnpm install --frozen-lockfile
pnpm --filter @sami/backend build
pnpm --filter @sami/backend db:migrate   # no ocultar errores: si falla, detener aquí
pnpm --filter @sami/frontend build

rm -rf /var/www/sami/*
cp -r apps/frontend/dist/* /var/www/sami/

pm2 restart sami-backend
```

**Rollback de código** (git checkout / tag) **no revierte migraciones de BD**; si hubo migraciones incompatibles hacia atrás, hace falta plan de BD aparte.

---

## 12. Checklist rápido

- [ ] DNS: `solucionesti2.aris.com.pe` → `172.16.40.25`
- [ ] Certificados instalados y rutas en `ssl_certificate` / `ssl_certificate_key`
- [ ] `apps/backend/.env` completo y `SESSION_SECRET` ≥ 32
- [ ] `SETTINGS_ENCRYPTION_KEY` definida si usarán credenciales en UI
- [ ] Redis y PostgreSQL accesibles desde el servidor
- [ ] `db:migrate` + `seed` + `seed:rbac` + `seed:so-catalog` ejecutados al menos una vez
- [ ] PM2 online y `pm2 startup` configurado
- [ ] `https://solucionesti2.aris.com.pe/api/health` OK
- [ ] PWA: HTTPS confiable en los navegadores de los usuarios

---

## 13. Referencia interna

- Migraciones: `apps/backend/src/core/database/migrations/` + `pnpm db:migrate` desde `apps/backend` (usa `drizzle.config.ts` y `.env`).
- Journal Drizzle: `migrations/meta/_journal.json` debe incluir todas las migraciones presentes en disco (si falta una entrada, `migrate` no la aplicará).
