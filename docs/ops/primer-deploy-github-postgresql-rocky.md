# Receta: GitHub + PostgreSQL + Rocky (primer deploy SAMI v2)

Orden recomendado: **(A) subir código a GitHub desde tu PC** → **(B) instalar PostgreSQL (y Redis) en el servidor** → **(C) clonar, `.env`, migrar, build, PM2, Nginx**.

Guía hermana con dominio y TLS: [`deploy-produccion-solucionesti2.md`](./deploy-produccion-solucionesti2.md).

---

## A. En tu PC (Windows) — GitHub **con todo el monorepo**

El snippet que muestra GitHub (`solo README.md`) sirve para un repo vacío de prueba; **SAMI v2** es un monorepo: tenés que versionar **`apps/`**, **`packages/`**, **`pnpm-lock.yaml`**, etc.

1. Abrí **PowerShell** o **Git Bash** en la carpeta raíz del proyecto (donde está `pnpm-workspace.yaml`).

2. Comprobá que **no** vayas a subir secretos:

   ```bash
   git status
   ```

   No deberían aparecer `apps/backend/.env` ni otros `.env` con contraseñas. El `.gitignore` del repo ya ignora `.env`.

3. Inicializá y commiteá **todo el código**:

   ```bash
   git init
   git add .
   git commit -m "chore: initial import SAMI v2 monorepo"
   git branch -M main
   git remote add origin https://github.com/darkwano27/samiv2.git
   ```

4. **Subir a GitHub** (elegí una forma):

   - **HTTPS**: GitHub ya no acepta contraseña de cuenta; necesitás un **Personal Access Token (PAT)** con permiso `repo`. Cuando pida password, pegá el token.

     ```bash
     git push -u origin main
     ```

   - **SSH** (recomendado a medio plazo): creá clave `ssh-keygen`, agregá la pública en GitHub → Settings → SSH keys, y usá el remoto SSH:

     ```bash
     git remote set-url origin git@github.com:darkwano27/samiv2.git
     git push -u origin main
     ```

5. En **github.com/darkwano27/samiv2** deberías ver `apps/`, `packages/`, `pnpm-lock.yaml`, etc.

---

## B. En el servidor Rocky — PostgreSQL (misma máquina que la app)

Asumimos PostgreSQL **en el mismo servidor** que Node (`172.16.40.25`) y que la app se conectará por **`127.0.0.1`**.

### B.1 Instalar e iniciar PostgreSQL

Rocky 8/9 (ajustá si usás un módulo de versión concreta, p. ej. 15):

```bash
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable postgresql --now
sudo systemctl status postgresql
```

### B.2 Crear base, usuario y permisos

```bash
sudo -u postgres psql
```

Dentro de `psql` (cambiá la contraseña):

```sql
CREATE USER sami_user WITH PASSWORD 'TU_PASSWORD_SEGURO';

CREATE DATABASE sami_app OWNER sami_user;

\c sami_app

GRANT ALL ON SCHEMA public TO sami_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sami_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sami_user;

\q
```

### B.3 Conexión local (backend en el mismo servidor)

Por defecto Postgres escucha en `localhost`. Tu `DATABASE_URL` en `apps/backend/.env` puede ser:

```env
DATABASE_URL=postgresql://sami_user:TU_PASSWORD_SEGURO@127.0.0.1:5432/sami_app
```

**Importante:** si la contraseña tiene caracteres especiales (`@`, `#`, etc.), codificalos en la URL (ej. `@` → `%40`).

Probá desde el servidor:

```bash
sudo dnf install -y postgresql  # cliente psql si no está
psql "postgresql://sami_user:TU_PASSWORD_SEGURO@127.0.0.1:5432/sami_app" -c "SELECT 1;"
```

Si falla por autenticación, revisá `pg_hba.conf` (suele estar bajo `/var/lib/pgsql/data/`): para `127.0.0.1/32` conviene una línea `scram-sha-256` o `md5` para el usuario de aplicación; luego `sudo systemctl restart postgresql`.

### B.4 Redis (mismo servidor)

SAMI usa Redis para sesiones / caché RBAC:

```bash
sudo dnf install -y redis
sudo systemctl enable redis --now
redis-cli ping
```

En `.env`:

```env
REDIS_URL=redis://127.0.0.1:6379
```

---

## C. En el servidor — usuario `sami`, clonar repo, instalar dependencias

Si ya hiciste la sección 3–4 de [`deploy-produccion-solucionesti2.md`](./deploy-produccion-solucionesti2.md) (Node 20, pnpm, PM2, nginx, carpetas), seguí:

```bash
sudo su - sami
cd /opt/sami-v2
git clone https://github.com/darkwano27/samiv2.git .
pnpm install --frozen-lockfile
```

(Con SSH: `git clone git@github.com:darkwano27/samiv2.git .` — necesitás clave SSH del usuario `sami` en GitHub o deploy key en el repo.)

---

## D. Variables de entorno del backend

```bash
nano /opt/sami-v2/apps/backend/.env
chmod 600 /opt/sami-v2/apps/backend/.env
```

Completá al menos: `DATABASE_URL`, `SAP_DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET` (≥32 caracteres), LDAP, `NODE_ENV=production`, `PORT=3000`, y si guardarán SMTP/credenciales en UI: `SETTINGS_ENCRYPTION_KEY`. Detalle en la guía de deploy principal.

---

## E. Migraciones, seeds, build, PM2, copiar frontend

```bash
cd /opt/sami-v2

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
```

Nginx + certificados + `ecosystem.config.cjs`: seguí las secciones 8–10 de [`deploy-produccion-solucionesti2.md`](./deploy-produccion-solucionesti2.md).

---

## F. Qué queda automático y qué no

| Acción | ¿Automático? |
|--------|----------------|
| `git push` crea tablas en PostgreSQL | **No** |
| `pnpm db:migrate` crea/actualiza tablas | **Sí**, dentro de una BD ya existente |
| `seed` / `seed:rbac` / `seed:so-catalog` cargan datos iniciales | **Sí**, si los ejecutás vos (`seed:so-catalog` = diagnósticos y medicamentos SO) |
| Instalar PostgreSQL en el servidor | **No** — lo hacés en la sección B |

---

## G. Actualizaciones después del primer deploy

En tu PC: `git add`, `commit`, `push`. En el servidor como `sami`:

```bash
cd /opt/sami-v2
git pull origin main
pnpm install --frozen-lockfile
pnpm --filter @sami/backend build
pnpm --filter @sami/backend db:migrate
pnpm --filter @sami/backend run seed:so-catalog
pnpm --filter @sami/frontend build
rm -rf /var/www/sami/* && cp -r apps/frontend/dist/* /var/www/sami/
pm2 restart sami-backend
```

Si `db:migrate` falla, **no sigas** con el restart hasta corregir la BD.
