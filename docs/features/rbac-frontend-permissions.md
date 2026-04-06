# Permisos en frontend (`permissions.ts`)

## Objetivo

Helpers alineados a **`.kiro/specs/sami-rbac/design.md`** (sección *Tipos de dominio frontend*) y al contrato actual de **`GET /auth/me`** vía `MeResult` / `AuthApiRepository`.

## Activación

En **`apps/frontend/.env`** (o el env que use Vite):

```env
VITE_RBAC_ENABLED=true
```

Rebuild (`pnpm --filter @sami/frontend build` o `dev`). Mientras la variable no sea exactamente `true`, **`RBAC_ENABLED`** es `false` y todas las funciones booleanas devuelven **permitido** (`true`), salvo que no apliquen por `session === null` en llamadas que ya cortan antes (el diseño Kiro pide “todo true” con flag off).

## API

| Función | Comportamiento con RBAC activo |
|---------|--------------------------------|
| `canAccessApp(session, appSlug)` | Superadmin; o rol cuyo `appSlug` coincide con la app de navegación; o **`managedModuleSlugs`** incluye el módulo de esa app (p. ej. admin de Salud Ocupacional ve todas las apps con slug bajo `salud-ocupacional`). Requiere `managed_module_slugs` en `GET /auth/me`. |
| `hasMinRole(session, appSlug, minLevel)` | Superadmin o `roleLevel >= minLevel` en esa app. |
| `canDo(session, appSlug, featureSlug, action)` | Unión de acciones en `app_roles` para esa app/feature. |
| `canRead(...)` | Atajo para `action === 'read'`. |
| `isModuleAdmin(session, moduleSlug)` | Rol con `roleSlug === 'module-admin'` en ese `moduleSlug` (o superadmin). |

`Session` es alias de **`MeResult`**: debe pobrase con datos reales de `/auth/me` (p. ej. tras un `getMe()` en el loader o un hook de sesión).

## Limitaciones MVP

- **`isModuleAdmin`**: depende del slug de rol `module-admin` en la respuesta; si solo usás apps `is_management` sin ese slug, habría que enriquecer `/auth/me` (p. ej. `is_management_app` por asignación) y actualizar el helper.

## Archivo

`apps/frontend/src/infrastructure/auth/permissions.ts`

## Historial

| Fecha | Cambio |
|-------|--------|
| 2026-03-27 | Helpers + `VITE_RBAC_ENABLED` + tipo `Session`. |
