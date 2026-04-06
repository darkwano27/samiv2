# RBAC — columna `role_permissions.actions`

## Objetivo

Persistir **qué acciones** otorga cada vínculo rol–feature (`read`, `create`, `update`, `delete`, etc.), de modo que la **matriz funcional** (por app y perfil) coincida con los `@RequirePermission(app, feature, action)` del backend.

## Esquema

- Tabla `role_permissions`: columnas `role_id`, `feature_id`, **`actions`** (`text[]`, `NOT NULL`, default `{read}`).
- Migración: `0007_role_permissions_actions.sql`.

## Resolución en runtime

`RbacService.resolvePermissions` fusiona las acciones leídas de BD para cada par rol–feature. Si el array viniera vacío, se usa como mínimo `read` (compatibilidad).

## Seed

`pnpm --filter @sami/backend seed:rbac`:

- Permisos base (`mis-consultas:viewer`, etc.) con `actions` explícitas.
- **Salud ocupacional** (apps operativas): solo roles `enfermera` y `jefe-so` por app, con acciones por producto:
  - Historial médico: `read`, `update`, `delete`
  - Inventario médico: `read`, `create`, `update`, `delete`
  - Mis consultas: `read` (rol `viewer`)
  - Registro de consulta: `read`, `create`
  - Reportes SO: `read`
  - Admin SO (slug `jefe-so`, perfil principal) además: `salud-ocupacional-gestion:module-admin`.
- **`module_profiles`** semilla: `enfermera`, `jefe-so` (etiqueta **Admin SO (perfil principal)**) + **`default_role_assignments`**. Perfiles `medico` / `farmaceutico` obsoletos se eliminan en seed si no tienen `applied_profile_id`.

## UI

**Ajustes SO → Perfiles** usa `GET .../profile-action-catalog` y el modal de perfil (acciones por app). `GET .../permission-matrix` sigue disponible para otras herramientas o documentación.
