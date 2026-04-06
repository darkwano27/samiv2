# API Ajustes — Salud Ocupacional (`/api/salud-ocupacional/module-settings`)

## Objetivo

Permitir a **administradores del módulo** Salud Ocupacional (y a **superadmin**) consultar el catálogo RBAC **filtrado al módulo** y **asignar o revocar roles** solo si el rol pertenece a una app con `module_slug = salud-ocupacional`.

No reemplaza `/api/admin/*`: el catálogo global y otras operaciones siguen reservadas a superadmin.

## Autenticación y autorización

- Cookie **`sami_session`** válida.
- **`SaludOcupacionalModuleAdminGuard`**: permite si la caché RBAC del worker tiene `is_superadmin` **o** `managed_module_slugs` incluye **`salud-ocupacional`** (p. ej. rol `module-admin` en la app `salud-ocupacional-gestion`).
- **401** sin sesión; **403** si no cumple el guard.
- Estas rutas **no** usan `@RequirePermission`; el `RbacGuard` global deja pasar cuando no hay metadata de permiso.

## Rutas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/salud-ocupacional/module-settings/rbac-catalog` | Apps, roles y features cuyo módulo es `salud-ocupacional`. |
| `GET` | `/api/salud-ocupacional/module-settings/profile-action-catalog` | Por app del módulo: `available_actions[]` para el modal de perfil; apps de gestión incluyen `management_note` (no se configuran en esta pantalla). Apps operativas pueden incluir `action_scope_note` (texto de alcance, p. ej. solo lectura y creación). |
| `GET` | `/api/salud-ocupacional/module-settings/members` | Workers con al menos una asignación en el módulo + detalle por app/rol. Query opcional: `search`, `page`, `limit`. Respuesta: `members[]` con `applied_profile_slug` / `applied_profile_label` cuando existan, `profile_counts` por slug (incluye perfiles custom). |
| `GET` | `/api/salud-ocupacional/module-settings/members/:workerId` | Detalle para el sheet: nombre, `assigned_at`, `applied_profile` opcional, `apps_with_access` (cada app puede incluir `profile_product_actions` si hay perfil aplicado con `app_permissions_json`, para alinear la UI con la plantilla y no con la unión del rol), `apps_without_access`. |
| `DELETE` | `/api/salud-ocupacional/module-settings/members/:workerId` | Revoca **todas** las asignaciones del worker en apps del módulo SO. Respuesta `{ revoked: number }`. |
| `POST` | `/api/salud-ocupacional/module-settings/members/:workerId/profile` | Body `{ "profile_slug": "<slug>" }` (cualquier perfil del módulo). Revoca todas las asignaciones del módulo y aplica el perfil (mismo efecto que `apply-profile` pero reemplazando). |
| `GET` | `/api/salud-ocupacional/module-settings/module-profiles` | Lista `module_profiles` con `module_slug = salud-ocupacional`: `role_count`, `member_count` (asignaciones con `applied_profile_id`), `is_seed`, `unique_apps_count`, `permission_matrix_cells` (filas en `role_permissions` de los roles del perfil). |
| `GET` | `/api/salud-ocupacional/module-settings/module-profiles/:profileId` | Detalle: metadatos, `roles[]`, `app_permissions[]` (para perfiles **no semilla**, las acciones marcadas en el modal se persisten en `app_permissions_json` y se devuelven tal cual; el rol resuelto puede ser más amplio para cubrir el pedido). |
| `POST` | `/api/salud-ocupacional/module-settings/module-profiles` | Crear perfil: `{ "label", "description?", "slug?", "app_permissions": [{ "app_slug", "actions": ["read", ...] }] }`. Al menos una acción en apps operativas. El backend elige el rol de catálogo que cubre cada app (mínimo exceso). Persistencia: `default_role_assignments`. |
| `PATCH` | `/api/salud-ocupacional/module-settings/module-profiles/:profileId` | Metadatos y/o `app_permissions` (igual que POST). Perfiles semilla: solo `label`/`description`. **Cambiar permisos no altera miembros ya asignados**; aplica solo a `apply-profile` / `replace` futuros (`note` opcional). |
| `DELETE` | `/api/salud-ocupacional/module-settings/module-profiles/:profileId` | Elimina perfil si no es semilla **y** `member_count === 0` (sin `worker_role_assignments.applied_profile_id` hacia ese perfil). |
| `GET` | `/api/salud-ocupacional/module-settings/permission-matrix` | Filas rol × feature × `actions[]` para la matriz en UI. Ver [`rbac-role-permissions-actions.md`](./rbac-role-permissions-actions.md). |
| `POST` | `/api/salud-ocupacional/module-settings/apply-profile` | Body `{ "worker_id", "profile_slug": "<slug>" }`. Aplica todos los roles de `default_role_assignments`; cada asignación creada lleva `applied_profile_id`. Duplicados (worker ya tiene el rol) se omiten. |
| `GET` | `/api/salud-ocupacional/module-settings/workers/:workerId/assignments` | Asignaciones del worker **solo** si `module_slug` de la app del rol es `salud-ocupacional`. |
| `POST` | `/api/salud-ocupacional/module-settings/worker-assignments` | Mismo body que admin: `{ "worker_id": "<pernr>", "role_id": "<uuid>" }`. Valida que el rol sea del módulo SO. |
| `DELETE` | `/api/salud-ocupacional/module-settings/assignments/:assignmentId` | Revoca solo si la asignación es de una app del módulo SO. |
| `GET` | `/api/salud-ocupacional/module-settings/email-settings` | Configuración SMTP del módulo (sin contraseña en claro). `null` si aún no está guardada. |
| `PATCH` | `/api/salud-ocupacional/module-settings/email-settings` | Body: `smtp_host`, `smtp_port`, `mail_secure`, `smtp_user`, `smtp_from`, `smtp_pass` opcional (`""` borra la guardada). Requiere `SETTINGS_ENCRYPTION_KEY` en el servidor. |
| `POST` | `/api/salud-ocupacional/module-settings/email-settings/test` | Body `{ "to": "<email>" }`. Envío de prueba usando la fila guardada. |

Tras asignar o revocar se invalida la caché Redis de permisos del worker afectado (igual que en `AdminService`).

### Correo del sistema (`module_slug = system`)

No van en esta ruta: el SMTP global lo configura **solo superadmin** vía **`GET/PATCH/POST /api/admin/settings/email`** (misma forma de body que arriba; ver [`rbac-admin-api.md`](./rbac-admin-api.md)). La fila `system` puede tener `smtp_host = '__USE_ENV__'` para que el envío use **`SMTP_*`** del servidor hasta que se defina un host real en la tabla.

Arquitectura unificada: [`module-email-pdf-architecture.md`](./module-email-pdf-architecture.md).

## Archivos (backend)

| Ruta en repo | Rol |
|--------------|-----|
| `apps/backend/src/modules/salud-ocupacional/so-module-settings.controller.ts` | HTTP |
| `apps/backend/src/modules/salud-ocupacional/guards/salud-ocupacional-module-admin.guard.ts` | Guard |
| `apps/backend/src/modules/rbac/services/admin.service.ts` | Catálogo módulo, asignar/revocar en módulo, `listWorkersInModule`, `getPermissionMatrixForModule`, `listModuleProfiles`, CRUD perfiles SO, `applyModuleProfile` (con `applied_profile_id`) |
| `apps/backend/src/modules/salud-ocupacional/dto/so-module-settings.dto.ts` | Zod `apply-profile`, `create/update` perfiles, SMTP |
| `apps/backend/src/modules/salud-ocupacional/module-smtp.service.ts` | SMTP por módulo (`module_smtp_settings`), cifrado, prueba de envío |
| `apps/backend/src/core/crypto/settings-encryption.ts` | Cifrado de secretos de configuración |
| `docs/features/module-email-pdf-architecture.md` | Correo vs env global y estrategia PDF compartido |

## Frontend

- Ruta: `/salud-ocupacional/ajustes`.
- Sidebar: app `salud-ocupacional-ajustes` en `navigation-config.ts` (etiqueta **Ajustes**).
- Cliente SO: `apps/frontend/src/modules/salud-ocupacional/ajustes/repository/so-module-settings.api-repository.ts`.
- SMTP sistema (superadmin): `apps/frontend/src/modules/admin/repository/admin.api-repository.ts` (`fetchAdminSystemEmailSettings`, etc.) + `SoEmailSettingsTab` con **`variant="admin"`** en `AdminAjustesPage` (`/administracion/ajustes`).

## Historial

| Fecha | Cambio |
|-------|--------|
| 2026-03-27 | Versión inicial: catálogo filtrado, asignar/revocar en alcance SO. |
| 2026-03-27 | Miembros, perfiles, matriz, `apply-profile`; UI responsive PWA. |
| 2026-03-27 | Miembros: `GET/DELETE/POST .../members/:workerId` (detalle, revocar todo, reemplazar perfil) y sheet `SoMemberDetailSheet`. |
| 2026-03-27 | `GET .../members`: `search`, `page`, `limit`; `profile_counts` y paginación en `listWorkersInModule`. |
| 2026-03-27 | Fase C: CRUD `module-profiles`, `apply-profile` con `applied_profile_id`, UI crear/editar perfiles. |
| 2026-03-27 | Perfiles: `app_permissions` + `GET profile-action-catalog`; resolución de rol en backend; modal por acciones. |
| 2026-03-27 | `module_profiles.app_permissions_json`: guarda lo marcado en el modal; `GET module-profiles/:id` devuelve esas acciones (no la unión del rol). Catálogo: `action_scope_note` por app. |
| 2026-03-27 | `GET members/:id`: `profile_product_actions` por app cuando hay perfil aplicado con JSON (sheet alineado a la plantilla). |
| 2026-03-27 | SMTP por módulo: `email-settings`, tabla `module_smtp_settings`, `SETTINGS_ENCRYPTION_KEY`. |
| 2026-03-27 | `ModuleSmtpService` en `core/mail`; fila `system` + API `admin/settings/email`; doc alineada a `module-email-pdf-architecture.md`. |
