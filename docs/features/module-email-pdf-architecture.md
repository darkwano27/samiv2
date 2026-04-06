# Correo y PDF — arquitectura (SAMI V2)

## Correo (SMTP) — tabla `module_smtp_settings`

Una sola tabla por fila (`module_slug` único). **Contraseña** en BD cifrada con **`SETTINGS_ENCRYPTION_KEY`** (AES-256-GCM). Sin esa variable, el guardado de credenciales SMTP falla con error de servicio.

### Slugs de uso

| `module_slug` | Uso |
|---------------|-----|
| `system` | Correo global: auth (p. ej. contraseña temporal), recuperación de cuenta, avisos que no pertenecen a un módulo de negocio. |
| `salud-ocupacional`, `horas-extra`, … | SMTP dedicado del módulo (PDF, avisos del módulo). |

### Fallback `.env` (`SMTP_*`)

Las variables **`SMTP_HOST`**, **`SMTP_PORT`**, **`SMTP_USER`**, **`SMTP_PASS`**, **`SMTP_FROM`** son **respaldo cuando no hay fila utilizable en tabla** para ese `module_slug`, o cuando la fila indica explícitamente “usar entorno”:

- **`smtp_host = '__USE_ENV__'`** (`MODULE_SMTP_USE_ENV_MARKER` en código): el envío usa **`SMTP_*`** del servidor; **no** se guardan credenciales reales en esa fila hasta que el admin sustituya el host por un servidor SMTP real.
- Migración **`0010_system_module_smtp_row.sql`**: inserta la fila **`system`** con `__USE_ENV__` para que el despliegue inicial pueda depender solo del `.env` hasta que un superadmin configure SMTP en UI.

**Resolución en runtime:** `ModuleSmtpService.resolveForSend(moduleSlug)` devuelve transporte + `from` solo si hay fila con host distinto de `__USE_ENV__` y cifrado configurado; si no, **`EmailService`** y otros callers usan **`SMTP_*`**.

### APIs

| Alcance | Rutas | Doc |
|---------|--------|-----|
| Módulo (ej. SO) | `GET/PATCH /api/salud-ocupacional/module-settings/email-settings`, `POST .../test` | [`so-module-settings-api.md`](./so-module-settings-api.md) |
| Sistema (`system`) | `GET/PATCH /api/admin/settings/email`, `POST .../test` | [`rbac-admin-api.md`](./rbac-admin-api.md) |

### UI

| Pantalla | Ruta | Quién |
|----------|------|--------|
| Ajustes del módulo (ej. SO) | `/salud-ocupacional/ajustes` → tab Correo | Admin del módulo o superadmin |
| SMTP del sistema | `/administracion/ajustes` | Solo **superadmin** (app `administracion-ajustes` en `navigation-config.ts` + `SUPERADMIN_ONLY_NAV_APPS`) |

Cliente compartido de formulario: `apps/frontend/src/modules/salud-ocupacional/ajustes/components/SoEmailSettingsTab.tsx` — prop **`variant="admin"`** para endpoints admin; **`variant="salud-ocupacional"`** (default) para SO.

### Extender a otro módulo

1. Fila en `module_smtp_settings` con el `module_slug` del módulo.
2. Guard de admin del módulo + controlador que delegue en `ModuleSmtpService` con ese slug (mismo patrón que SO).

---

## PDF — Motor `@react-pdf/renderer`

**No** usar **pdfmake** ni **Puppeteer** para el motor principal de PDF en el backend.

| Pieza | Ubicación en repo |
|-------|-------------------|
| Servicio `PdfService` (`renderToBuffer`) | `apps/backend/src/core/services/pdf.service.ts` |
| Registro de fuentes (Geist / sistema) | `apps/backend/src/core/pdf/register-aris-fonts.ts` |
| Cabecera / pie corporativos ARIS | `apps/backend/src/core/pdf/components/ArisShell.tsx` |
| `PdfModule` (Nest) | `apps/backend/src/core/pdf/pdf.module.ts` |
| Logo opcional | `apps/backend/src/core/pdf/assets/` (ver `README.md` dentro) |

Cada **módulo de negocio** define sus **plantillas** como componentes React (`Document` / `Page`) bajo su carpeta, p. ej. `apps/backend/src/modules/salud-ocupacional/pdf/`, importando el shell desde `@core/pdf/components/ArisShell`.

Flujo típico: construir el árbol React-PDF → `PdfService.renderToBuffer()` → respuesta HTTP `application/pdf` o adjunto vía `ModuleSmtpService` + `createTransporterForModule('<slug>')`.

Si más adelante el volumen lo exige, se puede extraer el render a un worker sin cambiar el contrato hacia los módulos (mismo DTO de entrada/salida).

---

## Flujo “PDF por correo” (ejemplo SO)

1. Generar PDF con `PdfService` + plantilla del módulo.
2. Enviar con `ModuleSmtpService.createTransporterForModule('salud-ocupacional')` + `getFromAddress` (o `resolveForSend` si aplica), adjunto en el mail.

---

## Historial

| Fecha | Cambio |
|-------|--------|
| 2026-03-27 | Borrador: correo por módulo vs global, PDF compartido. |
| 2026-03-27 | Alineado: `system`, `__USE_ENV__`, `.env` fallback, admin `/api/admin/settings/email`, UI `/administracion/ajustes`, motor `@react-pdf/renderer` y rutas en `core/` + plantillas por módulo. |
