# Requirements Document — SAMI RBAC

## Introduction

SAMI v2 requiere un sistema de control de acceso basado en roles (RBAC) que separe tres preguntas fundamentales: QUÉ puede hacer un worker (permisos sobre features), DÓNDE puede hacerlo (scope: global, división o subdivisión), y QUIÉN lo autoriza (jerarquía de administración delegada). El sistema debe soportar roles globales y específicos de dominio, resolución de permisos por unión, cache en Redis, y una jerarquía de administración con SUPERADMIN y MODULE_ADMIN. El frontend expone helpers de permisos con un feature flag `RBAC_ENABLED` para activación gradual.

**Alineación con el monorepo SAMI v2 (auth actual):** el identificador operativo del trabajador es **`sap_code`**, equivalente a **`pernr`** en la tabla SAP **`eiis_trabajadores`**. La sesión no usa `express-session`: es cookie HttpOnly **`sami_session`** + Redis **`sess:{uuid}`** con payload `{ sapCode, workerName }` e índice **`user_sessions:{sapCode}`**. Las FK RBAC `worker_id` / `assigned_by` deben usar el **mismo texto** que `workers.id` (recomendado: igual a `sap_code` / `pernr`). Implementación del código: `apps/backend`, frontend: `apps/frontend`.

---

## Glossary

- **RBAC_System**: El sistema de control de acceso basado en roles de SAMI v2.
- **Worker**: Empleado en SAMI identificado por **`sap_code`** (número de personal / `pernr` en SAP). En tablas locales, `workers.id` y columnas `worker_id` RBAC son **TEXT** con ese mismo valor.
- **App**: Aplicación funcional dentro de un módulo de SAMI (ej. `registro-horas-extra`).
- **Module**: Agrupación lógica de apps relacionadas (ej. `horas-extra`, `salud-ocupacional`).
- **Management_App**: App con `is_management=true`; cada módulo puede tener máximo una.
- **App_Feature**: Capacidad específica dentro de una app (ej. `consultas`, `boletas`).
- **Role**: Conjunto de permisos con un nivel jerárquico (1–5) y un scope de aplicabilidad.
- **Global_Role**: Rol aplicable a cualquier app (ej. `superadmin`, `module-admin`).
- **Domain_Role**: Rol específico de un conjunto de apps (ej. `he-registrador`).
- **Role_Permission**: Conjunto de acciones permitidas sobre una feature para un rol dado.
- **Action**: Operación atómica sobre una feature (ej. `read`, `create`, `update`, `delete`, `approve`).
- **Worker_Role_Assignment**: Asignación activa de un rol a un worker para una app y scope específicos.
- **Scope**: Ámbito geográfico/organizacional de una asignación: `global`, `division` o `subdivision`.
- **Scope_Id**: UUID de la división o subdivisión cuando el scope no es global.
- **Module_Profile**: Plantilla de asignación que agrupa un rol por app para un módulo.
- **Module_Profile_Item**: Fila de un perfil que asocia una app con un rol.
- **Default_Role_Assignment**: Asignación automática de rol que se aplica a todos los workers al registrarse.
- **SUPERADMIN**: Rol de nivel 5 con acceso total y bypass de todas las restricciones RBAC.
- **MODULE_ADMIN**: Rol de nivel 4 (`module-admin`) con acceso a la app de gestión de su módulo y scope limitado.
- **Permission_Cache**: Cache Redis con TTL de 5 minutos que almacena los permisos resueltos de un worker.
- **Permission_Union**: Resultado de combinar los permisos de todos los roles activos de un worker en una app.
- **Soft_Delete**: Mecanismo de revocación que registra `revoked_at` sin eliminar la fila.
- **Temp_Password**: Contraseña temporal generada durante registro o recuperación (gestionada por el módulo de auth).
- **RbacGuard**: Guard global de NestJS que intercepta requests y verifica permisos RBAC.
- **RequirePermission**: Decorador NestJS que declara la feature y acción requeridas en un endpoint.
- **Seed_Data**: Datos iniciales insertados en la base de datos al desplegar el sistema.

---

## Requirements

### Requirement 1: Modelo de datos — Apps

**User Story:** As a SUPERADMIN, I want the system to maintain a catalog of apps with their management flags, so that I can control which apps exist and which are management apps per module.

#### Acceptance Criteria

1. THE RBAC_System SHALL persist apps in a table with fields: `id` (UUID PK), `slug` (UNIQUE NOT NULL), `module_slug` (NOT NULL), `label` (NOT NULL), `description`, `is_management` (BOOLEAN DEFAULT false), `created_at`.
2. WHEN a new app is created with `is_management=true`, THE RBAC_System SHALL reject the creation IF another app with `is_management=true` already exists for the same `module_slug`.
3. THE RBAC_System SHALL seed el catálogo de apps alineado al producto (sin `sync-sap`: no hay sincronización masiva; SAP es fuente de lectura para maestros). Entre otras, apps de ejemplo: `registro-horas-extra`, `gestion-roles-he` (is_management=true), apps de salud ocupacional, sistemas, CRM, visitas, y en `administracion` p. ej. `gestion-usuarios`, `roles-global`, `asignaciones-global` con `is_management=true` donde corresponda.

---

### Requirement 2: Modelo de datos — App Features

**User Story:** As a SUPERADMIN, I want to define features within each app, so that permissions can be granted at the feature level.

#### Acceptance Criteria

1. THE RBAC_System SHALL persist app features in a table with fields: `id` (UUID PK), `app_id` (FK → apps.id NOT NULL), `slug` (NOT NULL), `label` (NOT NULL), `description`.
2. THE RBAC_System SHALL enforce a UNIQUE constraint on `(app_id, slug)` in the app features table.

---

### Requirement 3: Modelo de datos — Roles

**User Story:** As a SUPERADMIN, I want to define roles with levels and applicable apps, so that I can control the scope of each role's authority.

#### Acceptance Criteria

1. THE RBAC_System SHALL persist roles in a table with fields: `id` (UUID PK), `slug` (UNIQUE NOT NULL), `label` (NOT NULL), `level` (SMALLINT CHECK 1–5 NOT NULL), `is_global` (BOOLEAN NOT NULL), `applicable_apps` (UUID[] nullable), `description`, `created_by` (FK → workers), `created_at`.
2. THE RBAC_System SHALL seed the following global roles (`is_global=true`): `superadmin` (level 5), `module-admin` (level 4), `approver` (level 3), `editor` (level 2), `viewer` (level 1).
3. THE RBAC_System SHALL seed the following domain roles (`is_global=false`) for the `horas-extra` module: `he-registrador` (level 2, applicable to `registro-horas-extra`), `he-supervisor` (level 3, applicable to `registro-horas-extra`), `he-aprobador` (level 3, applicable to `registro-horas-extra`).
4. WHEN a worker attempts to create a new role, THE RBAC_System SHALL reject the request UNLESS the worker has the `superadmin` role.

---

### Requirement 4: Modelo de datos — Role Permissions

**User Story:** As a SUPERADMIN, I want to assign actions to roles per feature, so that I can control what each role can do within each app feature.

#### Acceptance Criteria

1. THE RBAC_System SHALL persist role permissions in a table with fields: `id` (UUID PK), `role_id` (FK → roles.id NOT NULL), `feature_id` (FK → app_features.id NOT NULL), `actions` (TEXT[] DEFAULT '{}' NOT NULL).
2. THE RBAC_System SHALL enforce a UNIQUE constraint on `(role_id, feature_id)` in the role permissions table.
3. THE RBAC_System SHALL support the following predefined actions in the MVP: `read`, `create`, `update`, `delete`, `approve`.
4. THE RBAC_System SHALL allow adding new action values (ej. `annul`, `export`, `reopen`) without requiring a database schema migration.

---

### Requirement 5: Modelo de datos — Worker Role Assignments

**User Story:** As a MODULE_ADMIN, I want to assign roles to workers with a specific scope, so that workers can access the apps they need within their organizational boundary.

#### Acceptance Criteria

1. THE RBAC_System SHALL persist worker role assignments in a table with fields: `id` (UUID PK), `worker_id` (FK → workers NOT NULL), `role_id` (FK → roles.id NOT NULL), `app_id` (FK → apps.id NOT NULL), `scope` (VARCHAR CHECK IN ('global','division','subdivision') NOT NULL), `scope_id` (UUID nullable), `applied_profile_id` (FK → module_profiles nullable), `assigned_by` (FK → workers NOT NULL), `assigned_at` (TIMESTAMPTZ DEFAULT now()), `revoked_at` (TIMESTAMPTZ nullable).
2. THE RBAC_System SHALL create the following indexes on the worker role assignments table (WHERE revoked_at IS NULL): `idx_wra_worker` on `worker_id`, `idx_wra_app` on `app_id`, `idx_wra_scope` on `scope`, `idx_wra_profile` on `applied_profile_id`.
3. WHEN a worker has multiple active role assignments for the same app, THE RBAC_System SHALL resolve permissions by computing the union of all active role permissions for that app.
4. WHEN a role assignment is revoked, THE RBAC_System SHALL set `revoked_at` to the current timestamp WITHOUT deleting the row (Soft_Delete).

---

### Requirement 6: Modelo de datos — Module Profiles

**User Story:** As a MODULE_ADMIN, I want to create assignment templates (profiles) for my module, so that I can assign a standard set of roles to workers efficiently.

#### Acceptance Criteria

1. THE RBAC_System SHALL persist module profiles in a table with fields: `id` (UUID PK), `module_slug` (NOT NULL), `slug` (NOT NULL), `label` (NOT NULL), `description`, `created_by` (FK → workers), `created_at`, `updated_at`.
2. THE RBAC_System SHALL enforce a UNIQUE constraint on `(module_slug, slug)` in the module profiles table.
3. THE RBAC_System SHALL persist module profile items in a table with fields: `id` (UUID PK), `profile_id` (FK → module_profiles.id NOT NULL), `app_id` (FK → apps.id NOT NULL), `role_id` (FK → roles.id NOT NULL).
4. THE RBAC_System SHALL enforce a UNIQUE constraint on `(profile_id, app_id)` in the module profile items table, allowing only one role per app per profile.
5. THE RBAC_System SHALL seed the following predefined profiles: `Registrador HE`, `Supervisor HE`, `Aprobador HE` (módulo `horas-extra`); `Médico Ocupacional`, `Enfermera`, `Farmacéutico`, `Jefe SO` (módulo `salud-ocupacional`); `Operador TI`, `Jefe TI` (módulo `sistemas`).
6. WHEN a MODULE_ADMIN modifies a module profile, THE RBAC_System SHALL NOT alter the existing Worker_Role_Assignments of workers who were previously assigned via that profile.
7. IF a profile item references a role with `level >= 4`, THEN THE RBAC_System SHALL reject the profile item creation with an error indicating that profiles cannot include roles of level 4 or higher.

---

### Requirement 7: Modelo de datos — Default Role Assignments

**User Story:** As a SUPERADMIN, I want to configure default role assignments, so that workers automatically receive baseline access when they are registered or synchronized.

#### Acceptance Criteria

1. THE RBAC_System SHALL persist default role assignments in a table with fields: `id` (UUID PK), `role_id` (FK → roles.id NOT NULL), `app_id` (FK → apps.id NOT NULL), `scope` (DEFAULT 'global'), `created_by` (FK → workers), `created_at`.
2. THE RBAC_System SHALL enforce a UNIQUE constraint on `app_id` in the default role assignments table.
3. THE RBAC_System SHALL seed the following default assignments: `mis-consultas` → `viewer` (scope global), `mis-equipos` → `viewer` (scope global).
4. WHEN a worker is registered or synchronized from SAP, THE RBAC_System SHALL automatically create Worker_Role_Assignments for each active default role assignment.

---

### Requirement 8: Jerarquía de administración — SUPERADMIN

**User Story:** As a SUPERADMIN, I want unrestricted access to all system functions, so that I can manage the entire RBAC configuration without limitations.

#### Acceptance Criteria

1. WHILE a worker has the `superadmin` role, THE RBAC_System SHALL grant access to all apps without evaluating role assignments (SUPERADMIN bypass).
2. THE RBAC_System SHALL allow only workers with the `superadmin` role to create, edit, and delete roles and role permissions.
3. THE RBAC_System SHALL allow only workers with the `superadmin` role to assign or revoke the `module-admin` and `superadmin` roles.
4. THE RBAC_System SHALL allow only workers with the `superadmin` role to manage apps, app features, default role assignments, and global configuration.
5. WHEN a worker attempts to assign the `superadmin` role, THE RBAC_System SHALL reject the request UNLESS the requesting worker also has the `superadmin` role.

---

### Requirement 9: Jerarquía de administración — MODULE_ADMIN

**User Story:** As a MODULE_ADMIN, I want to manage role assignments within my module and scope, so that I can onboard workers to my module without needing SUPERADMIN intervention.

#### Acceptance Criteria

1. WHILE a worker has the `module-admin` role for a module, THE RBAC_System SHALL grant that worker access to the Management_App of that module.
2. THE RBAC_System SHALL allow MODULE_ADMIN workers to create and edit profiles only within their own module.
3. THE RBAC_System SHALL allow MODULE_ADMIN workers to apply profiles and individual assignments only within their assigned scope (division or subdivision).
4. IF a MODULE_ADMIN attempts to assign a role with `level >= 4`, THEN THE RBAC_System SHALL reject the request with a 403 error.
5. IF a MODULE_ADMIN attempts to manage assignments in a module other than their own, THEN THE RBAC_System SHALL reject the request with a 403 error.
6. IF a MODULE_ADMIN has `scope=division`, THEN THE RBAC_System SHALL restrict that MODULE_ADMIN to assigning roles with `scope=division` or `scope=subdivision` only within their own division.

---

### Requirement 10: Jerarquía de administración — Roles funcionales

**User Story:** As a functional role holder (approver, editor, viewer), I want access to app features within my assigned scope, so that I can perform my job functions without accessing data outside my boundary.

#### Acceptance Criteria

1. WHILE a worker has the `approver` role (level 3) for an app, THE RBAC_System SHALL grant that worker read and approve actions within their assigned scope.
2. WHILE a worker has the `editor` role (level 2) for an app, THE RBAC_System SHALL grant that worker read, create, and update actions within their assigned scope.
3. WHILE a worker has the `viewer` role (level 1) for an app, THE RBAC_System SHALL grant that worker only read actions within their assigned scope.
4. WHEN a worker with `scope=division` accesses data, THE RBAC_System SHALL filter results to include only records belonging to that worker's `division_id`.
5. WHEN a worker with `scope=subdivision` accesses data, THE RBAC_System SHALL filter results to include only records belonging to that worker's `subdivision_id`.

---

### Requirement 11: Resolución de permisos en runtime

**User Story:** As a backend service, I want a deterministic permission resolution algorithm, so that access control decisions are consistent and auditable.

#### Acceptance Criteria

1. WHEN a worker makes a request to a protected endpoint, THE RBAC_System SHALL evaluate permissions in the following order: (1) SUPERADMIN bypass, (2) active assignments check, (3) Permission_Union computation, (4) action verification, (5) scope application.
2. WHEN a worker has no active Worker_Role_Assignments for the requested app, THE RBAC_System SHALL return HTTP 403.
3. WHEN a worker has multiple active Worker_Role_Assignments for the same app, THE RBAC_System SHALL compute the Permission_Union of all role permissions across those assignments.
4. WHEN the required action is not present in the Permission_Union for the requested feature, THE RBAC_System SHALL return HTTP 403.
5. WHEN a worker's assignment has `scope=global`, THE RBAC_System SHALL apply no data filter to query results.
6. WHEN a worker's assignment has `scope=division`, THE RBAC_System SHALL inject `division_id` into the request context for downstream filtering.
7. WHEN a worker's assignment has `scope=subdivision`, THE RBAC_System SHALL inject `subdivision_id` into the request context for downstream filtering.

---

### Requirement 12: Cache de permisos

**User Story:** As a backend service, I want permission resolution results cached in Redis, so that repeated permission checks do not incur database queries on every request.

#### Acceptance Criteria

1. THE RBAC_System SHALL store resolved permissions in Redis with a TTL of 5 minutes using a stable worker key **`rbac:perms:{worker_id}`** where `worker_id` is the same TEXT identifier as `workers.id` (typically **`sap_code` / `pernr`**, not a UUID).
2. THE RBAC_System SHALL store the following structure in the Permission_Cache: `workerId` (TEXT = `sap_code` / `workers.id`), `isSuperadmin`, and an `assignments` array where each entry contains `appSlug`, **`moduleSlug`**, `roleSlug`, `roleLevel`, `scope`, `scopeId`, and a `permissions` map of feature slugs to action arrays.
3. WHEN a Worker_Role_Assignment is created or revoked for a worker, THE RBAC_System SHALL invalidate the Permission_Cache entry for that worker.
4. WHEN the permissions of a role are modified, THE RBAC_System SHALL invalidate the Permission_Cache entries for ALL workers who have an active assignment with that role.
5. THE RBAC_System SHALL only include features with at least one action in the `permissions` map of the Permission_Cache entry.

---

### Requirement 13: Endpoint /auth/me

**User Story:** As a frontend application, I want a single endpoint that returns the authenticated worker's identity and permissions, so that the UI can make access control decisions without additional requests.

#### Acceptance Criteria

1. THE RBAC_System SHALL extend the existing **`GET /api/auth/me`** (already secured by cookie **`sami_session`** + validación Redis) so the JSON **includes** al menos: identidad (`sap_code` o `worker_id` alineado a `workers.id`), nombre para UI (`worker_name` o `name`), **`is_superadmin`**, y **`app_roles`** (snake_case en contrato HTTP, coherente con el resto de auth).
2. THE RBAC_System SHALL include in each `app_roles` entry: `app_slug`, **`module_slug`** (del catálogo `apps`), `role_slug`, `role_level`, `scope`, `scope_id`, y un mapa `permissions` de feature slugs a arrays de acciones (alineado al Permission_Cache).
3. THE RBAC_System SHALL omit from the `permissions` map any feature that has no actions assigned to the worker.
4. WHEN an unauthenticated request is made to `GET /api/auth/me`, THE RBAC_System SHALL return HTTP 401.
5. THE RBAC_System SHALL NOT require a second HTTP round-trip for identity: la misma respuesta combina sesión + RBAC cuando el módulo RBAC esté activo.

---

### Requirement 14: Frontend — Permission Helpers

**User Story:** As a frontend developer, I want a set of permission helper functions, so that I can implement access control in the UI without duplicating permission logic.

#### Acceptance Criteria

1. THE RBAC_System SHALL provide the following helper functions en **`apps/frontend/src/infrastructure/auth/permissions.ts`**: `canAccessApp(session, appSlug)`, `hasMinRole(session, appSlug, minLevel)`, `canDo(session, appSlug, featureSlug, action)`, `canRead(session, appSlug, featureSlug)`, `isModuleAdmin(session, moduleSlug)`, `getAppScope(session, appSlug)`, `getAppScopes(session, appSlug)`.
2. WHILE `RBAC_ENABLED=false`, THE RBAC_System SHALL return `true` from all boolean permission helpers and non-null values from scope helpers regardless of the session content.
3. WHILE a session contains a worker with `isSuperadmin=true`, THE RBAC_System SHALL return `true` from all boolean permission helpers regardless of role assignments.
4. THE `getAppScope` helper SHALL return `{ scope, scopeId }` for the first active assignment of the worker in the given app, or `null` if no assignment exists.
5. THE `getAppScopes` helper SHALL return an array of `{ scope, scopeId, roleSlug }` for all active assignments of the worker in the given app.
6. THE `isModuleAdmin` helper SHALL consider `module-admin` solo cuando exista una asignación activa cuyo **`module_slug`** (proveniente del catálogo `apps` o expuesto en `app_roles`) coincida con el argumento `moduleSlug` — no usar heurísticas frágiles como `appSlug.startsWith(moduleSlug)`.

---

### Requirement 15: Backend — RbacGuard y RequirePermission

**User Story:** As a backend developer, I want a global guard and a decorator to protect endpoints declaratively, so that permission enforcement is consistent and requires minimal boilerplate.

#### Acceptance Criteria

1. THE RBAC_System SHALL provide a `@RequirePermission(appSlug, featureSlug, action)` decorator (tres argumentos: app, feature, acción) que anota métodos del controller con el permiso requerido.
2. THE RBAC_System SHALL register `RbacGuard` as a global `APP_GUARD` (p. ej. desde `RbacModule`, importado en `AppModule` sin duplicar guards innecesarios).
3. WHEN a request reaches an endpoint without the `@RequirePermission` decorator, THE RbacGuard SHALL allow the request to proceed without permission checks.
4. WHEN a request reaches an endpoint with the `@RequirePermission` decorator, THE RbacGuard SHALL resolver el worker actual leyendo la cookie **`sami_session`** y validando Redis (mismo criterio que `GET /auth/me`), obtener **`worker_id` = `sap_code`**, leer el Permission_Cache, y verificar la acción requerida.
5. WHILE a worker has `isSuperadmin=true`, THE RbacGuard SHALL allow the request to proceed without evaluating role assignments (SUPERADMIN bypass).
6. WHEN the worker does not have the required permission, THE RbacGuard SHALL return HTTP 403.
7. WHEN permission is granted, THE RbacGuard SHALL inject the resolved scope into the request context for use by downstream handlers.

---

### Requirement 16: Endpoints CRUD — SUPERADMIN

**User Story:** As a SUPERADMIN, I want a complete set of management endpoints, so that I can administer the entire RBAC configuration through the API.

#### Acceptance Criteria

1. THE RBAC_System SHALL expose the following role management endpoints accessible only to SUPERADMIN: `GET /api/admin/roles`, `POST /api/admin/roles`, `PUT /api/admin/roles/:id`, `DELETE /api/admin/roles/:id`, `PUT /api/admin/roles/:id/permissions`.
2. THE RBAC_System SHALL expose the following assignment management endpoints accessible only to SUPERADMIN: `GET /api/admin/assignments`, `POST /api/admin/assignments`, `DELETE /api/admin/assignments/:id`.
3. THE RBAC_System SHALL expose the following profile management endpoints accessible only to SUPERADMIN: `GET /api/admin/profiles`, `POST /api/admin/profiles`, `PUT /api/admin/profiles/:id`, `DELETE /api/admin/profiles/:id`.
4. THE RBAC_System SHALL expose the following default assignment endpoints accessible only to SUPERADMIN: `GET /api/admin/defaults`, `POST /api/admin/defaults`, `DELETE /api/admin/defaults/:id`.
5. WHEN a non-SUPERADMIN worker accesses any `/api/admin/*` endpoint, THE RBAC_System SHALL return HTTP 403.

---

### Requirement 17: Endpoints CRUD — MODULE_ADMIN

**User Story:** As a MODULE_ADMIN, I want endpoints to manage profiles and assignments within my module, so that I can onboard workers without SUPERADMIN access.

#### Acceptance Criteria

1. THE RBAC_System SHALL expose the following module-scoped endpoints accessible to MODULE_ADMIN: `GET /api/modules/:slug/profiles`, `POST /api/modules/:slug/profiles`, `PUT /api/modules/:slug/profiles/:id`, `DELETE /api/modules/:slug/profiles/:id`.
2. THE RBAC_System SHALL expose the following assignment endpoints for MODULE_ADMIN: `GET /api/modules/:slug/assignments`, `POST /api/modules/:slug/assignments`, `DELETE /api/modules/:slug/assignments/:id`, `POST /api/modules/:slug/assignments/bulk`, `DELETE /api/modules/:slug/assignments/bulk`.
3. THE RBAC_System SHALL expose read-only endpoints for MODULE_ADMIN: `GET /api/modules/:slug/workers`, `GET /api/modules/:slug/roles`.
4. WHEN a MODULE_ADMIN accesses `/api/modules/:slug/*` where `:slug` does not match their own module, THE RBAC_System SHALL return HTTP 403.

---

### Requirement 18: Reglas de seguridad

**User Story:** As a system architect, I want non-negotiable security rules enforced at the API layer, so that privilege escalation and cross-module access are structurally impossible.

#### Acceptance Criteria

1. WHEN a worker attempts to assign a role with `level >= their own role level`, THE RBAC_System SHALL reject the request with HTTP 403 (no privilege escalation).
2. WHEN a MODULE_ADMIN attempts to manage assignments in an app that does not belong to their module, THE RBAC_System SHALL reject the request with HTTP 403 (no cross-module access).
3. WHEN a worker attempts to assign a role to themselves, THE RBAC_System SHALL reject the request with HTTP 403 (no self-promotion).
4. WHEN a MODULE_ADMIN with `scope=division` attempts to assign a role with `scope=global` or a `scope_id` outside their division, THE RBAC_System SHALL reject the request with HTTP 403 (scope cascading).
5. WHEN a worker with the `he-registrador` role attempts to approve a boleta that they themselves registered, THE RBAC_System SHALL reject the request with HTTP 403 (HE segregation).
6. IF a profile item references a role with `level >= 4`, THEN THE RBAC_System SHALL reject the profile item creation with HTTP 400 (profiles do not escalate privileges).
