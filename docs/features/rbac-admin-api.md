# API admin RBAC (`/api/admin/*`)

## Objetivo

Operaciones de **catálogo y asignaciones** reservadas a **superadmin**, alineado a *Requirement 8* del spec `.kiro/specs/sami-rbac/requirements.md` (MVP incremental).

**Administradores de módulo** (p. ej. Salud Ocupacional) usan las rutas de alcance módulo documentadas en [`so-module-settings-api.md`](./so-module-settings-api.md), no este controlador.

Granularidad **read/create/update/delete** por rol–feature: columna `role_permissions.actions` — ver [`rbac-role-permissions-actions.md`](./rbac-role-permissions-actions.md).

## Autenticación y autorización

- Misma cookie **`sami_session`** que el resto de la API.
- **`SuperadminGuard`**: sesión válida + `is_superadmin: true` en el resultado de `PermissionCacheService.getOrResolve(sap_code)`.
- **401** sin sesión; **403** si la sesión no es superadmin.
- Estas rutas **no** usan `@RequirePermission`; el guard global `RbacGuard` las deja pasar (sin metadata de permiso).

## Rutas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/admin/workers/directory` | Directorio de trabajadores activos (SAP) + acceso/estado SAMI. Ver `docs/features/user-directory.md`. |
| `GET` | `/api/admin/rbac/catalog` | Lista `apps`, `roles` y `app_features` (snake_case en respuesta). |
| `GET` | `/api/admin/settings/email` | SMTP del sistema (`module_slug = system` en `module_smtp_settings`). Sin contraseña en claro; `null` si no hay fila. |
| `PATCH` | `/api/admin/settings/email` | Misma forma que el PATCH de módulo SO: `smtp_host`, `smtp_port`, `mail_secure`, `smtp_user`, `smtp_from`, `smtp_pass` opcional. Requiere `SETTINGS_ENCRYPTION_KEY` para guardar secretos. |
| `POST` | `/api/admin/settings/email/test` | Body `{ "to": "<email>" }`. Prueba: si la fila usa `smtp_host = '__USE_ENV__'` o no hay fila, usa `SMTP_*` del servidor. |
| `GET` | `/api/admin/rbac/modules-summary` | Resumen por módulo: `app_count`, `admins` (module-admin), `role_summary`, `total_workers_with_roles`. Excluye módulo `platform`. |
| `GET` | `/api/admin/rbac/workers/:workerId/assignments` | Asignaciones del worker (`worker_id` = `workers.id`, típicamente `pernr`). |
| `POST` | `/api/admin/rbac/worker-assignments` | Crea asignación manual; body JSON validado con Zod (ver abajo). Usado p. ej. para asignar `module-admin` desde Gestión de usuarios. |
| `DELETE` | `/api/admin/rbac/assignments/:assignmentId` | Elimina la asignación (fila en `worker_role_assignments`) e invalida caché Redis del worker. |

### `POST /api/admin/rbac/worker-assignments`

```json
{
  "worker_id": "64721",
  "role_id": "uuid-del-rol"
}
```

- **`worker_id`** es el **`pernr`** (código SAP). El backend valida que exista como **activo** en SAP staging y hace **upsert** en **`workers`** (solo espejo mínimo para FK; el maestro es SAP).
- No duplica asignación manual misma (`worker_id` + `role_id` + `applied_profile_id` nulo); si existe → **409**.
- Tras insertar, se llama **`PermissionCacheService.invalidate(worker_id)`**.

## Archivos

| Ruta en repo | Rol |
|--------------|-----|
| `apps/backend/src/modules/rbac/controllers/admin.controller.ts` | HTTP (incl. `settings/email` → `ModuleSmtpService` con slug `system`) |
| `apps/backend/src/modules/rbac/services/admin.service.ts` | Lógica + DB |
| `apps/backend/src/modules/rbac/guards/superadmin.guard.ts` | Guard |
| `apps/backend/src/modules/rbac/dto/admin.schemas.ts` | Zod |
| `apps/backend/src/core/mail/module-smtp.service.ts` | SMTP por `module_slug` (`system`, módulos de negocio) |

Contexto correo/PDF: [`module-email-pdf-architecture.md`](./module-email-pdf-architecture.md). UI: `/administracion/ajustes` (`AdminAjustesPage.tsx`).

## Admin de módulo — Salud Ocupacional (ejemplo)

Spec de navegación y módulos: `.kiro/specs/sami-dashboard-sidebar/design.md`. RBAC: `.kiro/specs/sami-rbac/design.md`.

1. Ejecutar `pnpm --filter @sami/backend seed:rbac` (o migrar + seed) para que existan en catálogo:
   - App **`salud-ocupacional-gestion`** (`is_management: true`, `module_slug: salud-ocupacional`).
   - Rol **`module-admin`** en esa app.
2. Como **superadmin**, `GET /api/admin/rbac/catalog` → copiar el `id` del rol `module-admin` de la app `salud-ocupacional-gestion`.
3. `POST /api/admin/rbac/worker-assignments` con `{ "worker_id": "<pernr>", "role_id": "<uuid>" }` (no hace falta crear el worker a mano: se sincroniza desde SAP al asignar).
4. El usuario debe volver a iniciar sesión (o esperar TTL de caché Redis) para que `GET /auth/me` incluya `managed_module_slugs: ["salud-ocupacional"]` y el frontend muestre **todas** las apps del módulo en sidebar/dashboard (`VITE_RBAC_ENABLED=true`).

## Pendiente (fuera de este MVP)

- Revocar asignaciones, CRUD completo de roles/apps/features, module-admin bajo `/api/module-admin/*`, validaciones extra (p. ej. solo superadmin asigna rol `superadmin` a otros).

## Verificación

```bash
pnpm --filter @sami/backend build
```

Postman: carpeta **Admin** (cookie tras login como usuario con rol superadmin en BD).

## Historial

| Fecha | Cambio |
|-------|--------|
| 2026-03-27 | MVP: catalog, list assignments, assign + invalidación caché. |
| 2026-03-27 | `GET admin/workers/directory` para gestión de usuarios (SAP + local_auth). |
| 2026-03-27 | Seed: app `salud-ocupacional-gestion` + rol `module-admin`; doc de asignación. |
| 2026-03-27 | `GET/PATCH/POST admin/settings/email` (SMTP `system`), referencia a arquitectura correo/PDF. |
