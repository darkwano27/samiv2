# Roadmap — Gestión de roles Salud Ocupacional (SO)

El spec **`.kiro/specs/sami-gestion-roles-modulo`** (Kiro) se usa **solo como guía de producto** (flujos, pantallas, criterios). La implementación sigue **este repo**: Nest + Drizzle, Redis RBAC, Vite + TanStack Router/Query, rutas bajo `salud-ocupacional/module-settings` y UI en `/salud-ocupacional/ajustes`.

**No** se replica el diseño técnico de Kiro (p. ej. `ModuleAdminModule` en `/api/modules/:slug`, Next.js, soft delete obligatorio) salvo decisión explícita.

---

## Estado actual (referencia)

| Área | Qué hay hoy |
|------|-------------|
| API | `so-module-settings` (catálogo, miembros, perfiles, matriz, `apply-profile`, asignar/revocar, **SMTP módulo SO**). Correo global: `admin/settings/email` (`system`). Ver [`so-module-settings-api.md`](./so-module-settings-api.md), [`rbac-admin-api.md`](./rbac-admin-api.md) y [`module-email-pdf-architecture.md`](./module-email-pdf-architecture.md). |
| UI | `SoAjustesView`: tabs Miembros, Perfiles, Correo; `?tab=`; **Correo** = `SoEmailSettingsTab` (módulo). SMTP sistema: **`/administracion/ajustes`** (`AdminAjustesPage`, `variant="admin"`). |
| RBAC | `SaludOcupacionalModuleAdminGuard`, invalidación Redis, `managed_module_slugs` para admin de módulo. |

---

## Tareas (solo SO)

Marcalas en el orden que el equipo prefiera; las dependencias suelen ser de arriba hacia abajo.

### Fase A — UX y detalle de miembro

- [x] **A1.** Sheet “Detalle de miembro” (panel lateral / drawer móvil) alineado al mock de Kiro: datos del worker (SAP, nombre si SAP staging), perfil inferido o explícito, **apps con acceso** (rol + acciones) y **apps sin acceso** del módulo SO.
- [x] **A2.** `GET /api/salud-ocupacional/module-settings/members/:workerId` (`AdminService.getMemberDetailForModule`).
- [x] **A3.** En el sheet: **Cambiar perfil** via `POST .../members/:workerId/profile` (revoca módulo + aplica perfil semilla; confirmación).
- [x] **A4.** `DELETE .../members/:workerId` (`revokeAllAssignmentsInModule`).
- [x] **A5.** Botón “Gestionar” abre el sheet; revocación puntual por `assignment_id` en el sheet.

### Fase B — Lista de miembros “producto”

- [x] **B1.** Búsqueda por nombre/SAP con **debounce** y parámetro `search` en backend (extender `listWorkersInModule` o lista de miembros).
- [x] **B2.** Paginación server-side (`page`, `limit`) en la misma lista.
- [x] **B3.** Estados vacíos / error / reintentar con el mismo patrón que el resto del shell.

### Fase C — Perfiles reutilizables (más allá de semillas)

- [x] **C1.** Modal **Crear perfil** / **Editar perfil** con nombre, descripción opcional y **acciones por app** (`read` / `create` / `update` / `delete`); el backend resuelve el rol de catálogo (sin mostrar nombres de rol al admin). Catálogo: `GET .../profile-action-catalog` (incl. `action_scope_note` por app). Las acciones marcadas se guardan en `module_profiles.app_permissions_json` para que el modal no muestre la unión amplia del rol resuelto.
- [x] **C2.** CRUD **solo** módulo SO vía `module_profiles` + `default_role_assignments`; app de gestión del módulo **no** se configura en el modal (bloque informativo / solo superadmin).
- [x] **C3.** Regla de producto: **editar perfil no altera** a miembros que ya lo tienen — solo nuevas asignaciones (documentar en código y respuesta API si aplica).
- [x] **C4.** Tab “Perfiles”: cards por perfil (miembros, apps, acciones) y eliminar perfil solo si `member_count === 0` (o equivalente en datos).

### Fase D — Pulido y trazabilidad

- [x] **D1.** Query param `?tab=miembros|perfiles|correo` para deep link y recarga.
- [x] **D2.** Invalidación cruzada React Query (ya parcial: resumen admin; mantener coherente al agregar mutaciones).
- [ ] **D3.** (Opcional) Auditoría mínima: quién asignó (`assigned_by` ya existe en esquema donde aplique).

### Fuera de alcance inmediato (decisión explícita)

- **Soft delete** (`revoked_at`) en `worker_role_assignments`: el spec Kiro lo asume; hoy el modelo usa borrado duro / `expires_at`. Migración y migración de datos = tarea aparte.
- **Generalizar** el mismo patrón a Horas extra / Visitas: no forma parte de este documento.

---

## Referencias en repo

- API: `apps/backend/src/modules/salud-ocupacional/so-module-settings.controller.ts`, `AdminService` (métodos SO).
- UI: `apps/frontend/src/modules/salud-ocupacional/ajustes/`.
- Permisos cliente: `apps/frontend/src/infrastructure/auth/permissions.ts`.

---

## Historial

| Fecha | Cambio |
|-------|--------|
| 2026-03-27 | Roadmap inicial SO; Kiro como guía, no implementación literal. |
| 2026-03-27 | Fase A implementada: sheet + endpoints `members/:workerId`. |
| 2026-03-27 | Fase B: `GET .../members?search&page&limit`, cards por perfil con conteos filtrados, UI búsqueda/paginación/empty/error. |
| 2026-03-27 | Fase C: CRUD perfiles SO, `applied_profile_id` en apply, `SoModuleProfileEditorDialog`, tab Perfiles con cards. |
| 2026-03-27 | Fase D: `?tab=` en Ajustes SO, invalidación centralizada, textos de UI en lenguaje claro. |
| 2026-03-27 | Doc: correo `system` + ruta admin `/administracion/ajustes` (fuera del alcance SO puro, referencia cruzada). |
