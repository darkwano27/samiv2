# Implementation Plan: SAMI RBAC

## Overview

Implementación incremental del sistema RBAC completo sobre el monorepo **SAMI v2** existente (`apps/backend` NestJS + Drizzle + Redis, `apps/frontend` Vite + React). La sesión ya usa cookie **`sami_session`** y Redis (`SessionService`); **`GET /api/auth/logout`** existe. Este plan corrige rutas respecto a un layout genérico `src/` en la raíz.

## Tasks

- [ ] 1. Drizzle schema — 8 tablas RBAC
  - [ ] 1.1 Crear archivos de schema Drizzle en **`apps/backend/src/core/database/schema/rbac/`**
    - Crear `apps.ts`, `app-features.ts`, `roles.ts`, `role-permissions.ts`, `worker-role-assignments.ts`, `module-profiles.ts`, `module-profile-items.ts`, `default-role-assignments.ts`
    - Usar `text('worker_id')` (no UUID) para todas las FK que referencian **`workers.id`** (TEXT = típicamente `sap_code` / `pernr`)
    - Incluir `customType` o tipo adecuado para `uuid[]` en `roles.applicable_apps`
    - Incluir **`module_slug`** en resolución/cache (ya modelado en tabla `apps`); las entradas cacheadas por asignación deben exponer `moduleSlug` para helpers frontend
    - Crear `index.ts` que re-exporte todas las tablas y enlazar desde `apps/backend/src/core/database/schema/index.ts` según convención del monorepo
    - _Requirements: 1.1, 2.1, 2.2, 3.1, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2_

  - [ ] 1.2 Generar y aplicar migración Drizzle
    - Ejecutar `pnpm --filter @sami/backend db:generate` y `db:migrate`
    - Verificar índices parciales (`WHERE revoked_at IS NULL`) y el índice único condicional (`WHERE is_management = true`)
    - _Requirements: 1.2, 5.2_

  - [ ]* 1.3 Escribir unit tests para el schema
    - Verificar constraints UNIQUE indicados en requirements
    - Verificar que `worker_id` y `assigned_by` son TEXT
    - _Requirements: 2.2, 4.2, 6.2, 6.4, 7.2_

- [ ] 2. Seed data — apps, roles, perfiles y defaults
  - [ ] 2.1 Crear **`apps/backend/src/core/database/seeds/rbac.seed.ts`** (o integrar en `seed.ts` existente)
    - Insertar apps del catálogo RBAC (sin app de sync SAP), roles, perfiles predefinidos, default assignments según seed (`mis-consultas`, `mis-equipos` → `viewer`, etc.)
    - Usar `onConflictDoNothing()` u equivalente para idempotencia
    - _Requirements: 1.3, 3.2, 3.3, 6.5, 7.3_

  - [ ]* 2.2 Escribir unit tests para seed data
    - _Requirements: 1.2, 1.3, 3.2, 7.3_

- [ ] 3. RbacService — resolución de permisos
  - [ ] 3.1 Implementar **`apps/backend/src/modules/rbac/rbac.service.ts`**
    - `resolvePermissions(workerId: string)` donde `workerId` es **TEXT** (`sap_code`)
    - Join con **`apps.module_slug`** y propagar `moduleSlug` en cada asignación cacheada
    - `getWorkerIdsByRole(roleId)`
    - _Requirements: 11.1–11.7, 12.2, 12.5_

  - [ ]* 3.2–3.3 Tests / property P2 (permission union)
    - _Requirements: 11.2, 11.3, 12.5_

- [ ] 4. PermissionCacheService
  - [ ] 4.1 Implementar **`apps/backend/src/modules/rbac/permission-cache.service.ts`**
    - Inyectar Redis con **`@Inject(REDIS_CLIENT)`** (mismo token que el resto del backend)
    - Clave: `rbac:perms:{workerId}` (TEXT), TTL 300s
    - _Requirements: 12.1–12.4_

  - [ ]* 4.2–4.4 Tests / properties P7, P13

- [ ] 5. Checkpoint — permisos + cache

- [ ] 6. RbacGuard y RequirePermission
  - [ ] 6.1 Decorator **`RequirePermission(appSlug, featureSlug, action)`** en `apps/backend/src/modules/rbac/`
  - [ ] 6.2 **`RbacGuard`**: validar sesión con **`SessionService.validateSession`** + cookie `sami_session` (no `request.session`); 401 si no hay sesión en rutas con decorator; luego cache RBAC
  - [ ] 6.3 **`AuthModule`**: **exportar `SessionService`** para que `RbacModule` pueda importarlo; usar **`forwardRef`** entre módulos si aparece dependencia circular
  - [ ] 6.4 Registrar **`RbacGuard`** como `APP_GUARD` desde **`RbacModule`** e importar **`RbacModule`** en **`AppModule`** (coexistir con `ThrottlerGuard` global existente)
  - _Requirements: 15.1–15.7_

  - [ ]* 6.5–6.6 Tests / properties P1, P11, P12

- [ ] 7. AdminService / AdminController (SUPERADMIN)
  - Rutas bajo `/api/admin/*` como en requirements; DTOs con Zod en `apps/backend/src/modules/rbac/dto/`
  - _Requirements: 8.2–8.4, 16.x, 18.x_

- [ ] 8. ModuleAdminService / ModuleAdminController
  - _Requirements: 9.x, 17.x_

- [ ] 9. Checkpoint — guard + admin APIs

- [ ] 10. Extender **`GET /api/auth/me`** (AuthController existente)
  - [ ] 10.1 **No duplicar el endpoint**: enriquecer la respuesta actual (`sap_code`, `worker_name`) con `worker_id` (= `sap_code`), `is_superadmin`, `app_roles[]` (con `module_slug` en cada ítem), usando `PermissionCacheService.getOrResolve(sapCode)`
  - [ ] 10.2 Mantener **401** si cookie/sesión inválida (misma semántica que hoy)
  - _Requirements: 13.1–13.5_

  - [ ]* 10.3 Tests para `/auth/me` extendido

- [ ] 11. **`POST /api/auth/logout`** — invalidar cache RBAC
  - [ ] 11.1 Tras `SessionService.revokeSessionByToken`, llamar **`PermissionCacheService.invalidate(sapCode)`** (misma clave que `worker_id`)
  - _Requirements: 12.3 (coherencia con cierre de sesión)_

- [ ] 12. Frontend — **`apps/frontend/src/infrastructure/auth/permissions.ts`**
  - Interfaces `Session` / `AppRoleAssignment` con **`moduleSlug`**; helpers según Req 14 (incl. `isModuleAdmin` por `moduleSlug`, no por prefijo de `appSlug`)
  - _Requirements: 14.x_

  - [ ]* 12.1 Tests + property P8

- [ ] 13. Checkpoint final
  - Verificar `pnpm --filter @sami/backend build` y `pnpm --filter @sami/frontend build`
  - Actualizar colección Postman si añadís endpoints admin

## Notes

- Tareas con `*` opcionales para MVP.
- **`workers.id`** es TEXT; en producción conviene alinear filas `workers` con SAP (`pernr`) para que FK RBAC sean coherentes.
- El spec asume monorepo **pnpm** en la raíz (`pnpm --filter @sami/backend …`).
- Property tests: `fast-check`, tag `Feature: sami-rbac, Property N: …`.
