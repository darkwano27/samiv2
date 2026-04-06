# `RbacGuard` y `@RequirePermission`

## Objetivo

Exigir **sesión autenticada** (cookie `sami_session` + Redis) y **permiso RBAC** explícito en handlers concretos, sin bloquear el resto de la API.

## Comportamiento

| Situación | Resultado |
|-----------|-----------|
| Handler **sin** `@RequirePermission` | El guard **no aplica** comprobación RBAC (`canActivate` → `true`). |
| Handler **con** `@RequirePermission` y sin cookie / sesión inválida | **401** `No autenticado`. |
| Sesión válida pero sin permiso | **403** `Sin permiso para esta acción`. |
| Permiso concedido | **200** (o la respuesta del handler). |

## Orden de guards globales (`AppModule`)

1. **`ThrottlerGuard`** — rate limiting.
2. **`RbacGuard`** — solo actúa si el handler (o la clase del controller) tiene metadata de permiso.

Registrar otro `APP_GUARD` sin coordinar puede alterar el orden; mantener ambos en `app.module.ts` como está documentado aquí.

## Decorador

```typescript
import { RequirePermission } from '@modules/rbac/decorators/require-permission.decorator';

@RequirePermission('mis-consultas', 'listar', 'read')
```

- **`appSlug`**: `apps.slug`.
- **`featureSlug`**: `app_features.slug` (por app).
- **`action`**: hoy el seed resuelve al menos **`read`** por vínculo rol–feature; cuando exista columna `actions` en `role_permissions`, se podrá granularizar.

## Cómo se decide el acceso (`RbacService.canAccess`)

1. **`is_superadmin`** en caché (asignación al rol `superadmin` en app `sami-platform`) → **permite todo**.
2. Unión de acciones del worker sobre **`appSlug` + `featureSlug`** según `app_roles` en caché.
3. **Admin de módulo**: si el worker tiene rol activo sobre una app con **`is_management = true`**, su `module_slug` entra en `managedModuleSlugs`. Si la app objetivo (`appSlug` del decorador) pertenece a ese módulo, se **permite cualquier feature/acción** de apps de ese módulo (equivalente al “R1 administra todo M1” del modelo conceptual).

La caché Redis (`rbac:perms:{workerId}`) incluye `managedModuleSlugs`; entradas antiguas sin ese campo se normalizan a `[]` al leer.

## Módulos Nest (`forwardRef`)

- **`AuthModule`** importa **`RbacModule`** (`forwardRef`) — `AuthService` usa `PermissionCacheService`.
- **`RbacModule`** importa **`AuthModule`** (`forwardRef`) — `RbacGuard` usa `SessionService`.

## Endpoint de prueba

- **`GET /api/rbac-smoke`**: requiere `@RequirePermission('mis-consultas', 'listar', 'read')` (o superadmin / admin de módulo `consultas`). Pensado para Postman tras login + cookie.

## Archivos relevantes

| Archivo | Rol |
|---------|-----|
| `apps/backend/src/modules/rbac/guards/rbac.guard.ts` | Guard |
| `apps/backend/src/modules/rbac/decorators/require-permission.decorator.ts` | Decorador |
| `apps/backend/src/modules/rbac/rbac.constants.ts` | Clave de metadata |
| `apps/backend/src/modules/rbac/services/rbac.service.ts` | `resolvePermissions`, `canAccess` |
| `apps/backend/src/modules/rbac/controllers/rbac-smoke.controller.ts` | Smoke test HTTP |
| `apps/backend/src/app.module.ts` | Registro `APP_GUARD` |

## API admin (superadmin)

Operaciones de catálogo y asignaciones: **`docs/features/rbac-admin-api.md`** (`/api/admin/*`, `SuperadminGuard`).

## Verificación manual

```bash
pnpm --filter @sami/backend build
```

1. Login con cookie → `GET /api/rbac-smoke` → 403 si no hay asignación; 200 si hay rol viewer en `mis-consultas` o superadmin.
2. `GET /api/health` → 200 sin cookie (sin decorador RBAC).

## Historial

| Fecha | Cambio |
|-------|--------|
| 2026-03-27 | Primera versión: guard global opt-in, admin de módulo, smoke controller. |
