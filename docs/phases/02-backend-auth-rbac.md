# Fase 2 — Auth y RBAC (esqueletos)

## Objetivo

Estructura de módulos lista para sesiones opacas (sin JWT) y RBAC futuro, más scripts de seed acoplados al package.

## Requisitos Kiro cubiertos

Requirement **7**.

## Entregables

- Auth multi-step lee maestro SAP **`eiis_trabajadores`** (`pernr`, `stat2`, `correo_corp`, `correo`, `perid`); ver `.kiro/specs/sami-auth-multistep/`.
- Contexto organizacional en **`GET /auth/me`**: división/subdivisión desde catálogos SAP y fallback; ver **`docs/features/auth-me-organization-enrichment.md`**.
- RBAC: spec **canónico** en **`.kiro/specs/sami-rbac/`** (`requirements.md`, `design.md`, `tasks.md`); guard en **`docs/features/rbac-guard-require-permission.md`**; admin en **`docs/features/rbac-admin-api.md`**; frontend en **`docs/features/rbac-frontend-permissions.md`**.
- `src/modules/auth/` (controller, service, módulo; carpetas `guards`, `decorators`, `infrastructure` con `.gitkeep` si aplica)
- `src/modules/rbac/` (service, módulo, `guards/rbac.guard.ts`, `decorators/require-permission.decorator.ts`, smoke `GET /api/rbac-smoke`)
- `src/core/database/seed.ts`, `seed-rbac.ts` y scripts `seed` / `seed:rbac` en `package.json`

## Mapa mental vs. modelo “USERS / MODULES / APPLICATIONS”

En SAMI el login viene de **SAP + `workers`** (`workers.id` = `pernr` / `sap_code`), no de una tabla `users` con email como PK. La lógica que describís encaja así:

| Tu concepto | SAMI actual (MVP) | Notas |
|-------------|-------------------|--------|
| `USERS` + `is_superadmin` | `workers` + rol **`superadmin`** en app `sami-platform` | El “superusuario” es una **asignación de rol**, no un booleano en el usuario. |
| `MODULES` (`code`) | `apps.module_slug` | No hay tabla `modules`; el módulo es el **slug de agrupación** de varias `apps`. |
| `APPLICATIONS` | `apps` (una fila por app; `slug` único) | Equivalente a APP1…APP5; `module_slug` las agrupa (ej. `MOD_A`). |
| `PERMISSIONS` (acciones por app) | `app_features` + (futuro) acciones en `role_permissions` | Hoy el vínculo rol–feature implica acciones mínimas (`read`) hasta alinear migración con el spec Kiro. |
| `ROLES` + `is_module_admin` | `roles` por **app** + flag `apps.is_management` | Un “admin de módulo” es un worker con rol activo en la app de gestión (`is_management = true`) de ese `module_slug`. `RbacService.canAccess` concede acceso a **todas** las apps del mismo módulo (ver **`docs/features/rbac-guard-require-permission.md`**). |
| `ROLE_PERMISSIONS` | `role_permissions` (rol ↔ feature) | Mismo espíritu: qué puede hacer cada rol sobre cada feature. |
| `USER_ROLES` | `worker_role_assignments` | `worker_id` → `workers.id` (texto). |

## RBAC backend (MVP en curso)

- Resolución de permisos: `RbacService.resolvePermissions(workerId)` con el esquema actual (`roles` por app, `worker_role_assignments` con `expires_at`; sin `scope` en DB todavía → se expone `scope: 'global'`). Incluye `managedModuleSlugs` para atajo de **admin de módulo**.
- Caché Redis: `PermissionCacheService`, clave `rbac:perms:{workerId}`, TTL 300s; invalidación en `POST /auth/logout`. Lectura normaliza caches antiguos sin `managedModuleSlugs`.
- **`RbacGuard`** (global, opt-in) + **`@RequirePermission(appSlug, featureSlug, action)`**: documentación en **`docs/features/rbac-guard-require-permission.md`**. Orden en `AppModule`: `ThrottlerGuard` → `RbacGuard`.
- **API superadmin** bajo **`/api/admin/*`**: **`docs/features/rbac-admin-api.md`** (`SuperadminGuard`, catálogo RBAC, listar / crear asignaciones a workers).
- **Frontend**: helpers en `infrastructure/auth/permissions.ts` + variable **`VITE_RBAC_ENABLED`** — **`docs/features/rbac-frontend-permissions.md`**.
- `GET /auth/me` incluye `worker_id`, `is_superadmin`, `app_roles[]` (además de org. SAP si aplica).
- Seed: `pnpm --filter @sami/backend run seed:rbac` → `src/core/database/seeds/rbac.seed.ts` (catálogo + perfil `default-operator`; no inserta asignaciones a trabajadores). El script carga `.env` desde `apps/backend/.env` vía `load-backend-env.ts` (también si corrés el comando desde la raíz del monorepo).

## Revisión externa (correcciones RBAC)

Paridad con notas tipo **`CORRECCIONES_RBAC_PARA_CURSOR`**: ver **`docs/reviews/rbac-correcciones-externas-2026-03.md`** (qué ya aplica, qué es N/A en el MVP, y qué falta al expandir schema/seed/Kiro).

**Convención seeds:** scripts `seed` / `seed:rbac` en `src/core/database/*.ts`; lógica RBAC reusable en `src/core/database/seeds/rbac.seed.ts`.

## Verificación

```bash
pnpm --filter @sami/backend build
pnpm --filter @sami/backend run seed
pnpm --filter @sami/backend run seed:rbac
```
