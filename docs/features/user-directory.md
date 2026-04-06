# Directorio de usuarios / trabajadores (`GET /api/admin/workers/directory`)

## Objetivo

Alimentar **Administración → Gestión de usuarios** con una vista tabular (TanStack Table) alineada al maestro SAP (`eiis_trabajadores`) y al estado de alta en SAMI (`local_auth` + reglas de `AuthService.identify`).

## Autorización

- Misma política que el resto de `/api/admin/*`: cookie de sesión + **`SuperadminGuard`** (`is_superadmin` en caché RBAC).
- **403** si la sesión no es superadmin (la pantalla puede abrirse con `canAccessApp('gestion-usuarios')` cuando RBAC está laxo; la API sigue siendo estricta).
- **503** si `SAP_DB` no está conectado.

## Semántica de columnas

| Campo API | Columna UI | Regla |
|-----------|------------|--------|
| `sap_code` | Cód. trabajador | `pernr` del registro vigente (activo `stat2 = 3`). |
| `nombre` / `apellido` | Nombre y apellido | `vorna` / `nachn` SAP. |
| `access` | Acceso | `ad` si `correo_corp` tiene valor; si no, `local` (flujo local, con o sin alta). |
| `status` | Estado | `activo` si AD **o** existe fila en `local_auth` para ese `sap_code`; si no, `pendiente` (equivalente a `new-local` en identify). |
| `local_account_locked` | Cuenta local / Acciones | `true` si existe `local_auth` y `locked_until` &gt; ahora (bloqueo por intentos fallidos de contraseña en login local). |

## UI (gestión de usuarios)

- Búsqueda por código o nombre, filtros por acceso (AD / Local) y estado (Activo / Pendiente).
- Paginación configurable (10 / 25 / 50 / 100 filas por página).
- **Desbloquear**: `POST /api/admin/workers/:sapCode/unlock-local-auth` (superadmin), pone `failed_login_attempts = 0` y `locked_until = null`.

## Bloqueo de cuentas locales

- Tras **5** intentos fallidos seguidos de contraseña en login local, se fija `locked_until` (**30 min**). Al expirar, el contador se reinicia en el siguiente intento.
- **AD / LDAP** no usa esta tabla: el bloqueo corporativo lo define el directorio, no SAMI.

## Implementación

| Capa | Ruta |
|------|------|
| Backend | `AdminService.listWorkersDirectory`, `unlockLocalAccount`; `AdminController` `GET admin/workers/directory`, `POST admin/workers/:sapCode/unlock-local-auth` |
| Frontend | `modules/admin/*`, ruta `administracion/gestion-usuarios` |

## Relación con RBAC y “admins de módulo”

- **Asignar a un usuario como admin de un módulo** es parte del **mismo RBAC**: roles por app (p. ej. `module-admin` asociado a la app de gestión del módulo) vía `POST /api/admin/rbac/worker-assignments` y catálogo `GET /api/admin/rbac/catalog`.
- Una UI dedicada “elegir admins del módulo X” sería una **capa de producto** sobre esas asignaciones, no un sistema aparte.
- Ver también `docs/features/rbac-admin-api.md` y `docs/features/rbac-frontend-permissions.md` (`isModuleAdmin`).
