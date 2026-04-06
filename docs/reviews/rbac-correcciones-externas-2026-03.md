# Revisión: `CORRECCIONES_RBAC_PARA_CURSOR.md` vs código SAMI v2

Documento de referencia externa revisado el **2026-03-27** frente al repo actual.

## Corrección 1 — Eliminar `he-registrador` (7 roles)

| Estado en SAMI v2 | **No aplica al seed actual** |
|-------------------|------------------------------|

`apps/backend/src/core/database/seeds/rbac.seed.ts` solo define **3 roles** (`superadmin` + dos `viewer` en apps distintas). No existe `he-registrador`.

**Acción:** cuando se amplíe el seed al catálogo completo (22 apps / roles HE), seguir la regla de **7 roles** y **no** incluir `he-registrador`.

**Nota:** `.kiro/specs/sami-rbac/requirements.md` y `design.md` aún mencionan `he-registrador` y 3 roles HE. Conviene **actualizar el spec Kiro** para que coincida con el diseño acordado (fuente de verdad única).

---

## Corrección 2 — `scope_id`: UUID → `VARCHAR(20)` (códigos SAP)

| Estado en SAMI v2 | **Parcialmente alineado** |
|-------------------|---------------------------|

La tabla `worker_role_assignments` **aún no tiene** columnas `scope` ni `scope_id` (MVP previo al SQL completo del spec). En caché/API se expone `scope: 'global'` y `scope_id: null` fijos.

**Criterio:** **De acuerdo** con usar **`VARCHAR(20)`** (o similar) para `scope_id` al persistir división/subdivisión SAP (`AR90`, `9040`), **no UUID**.

**Desacuerdo con Kiro actual:** el `design.md` de Kiro muestra `scope_id UUID`. Eso habría que **corregir en el spec** cuando se formalice la migración, para no reintroducir UUID por error.

**Implementación pendiente:** migración Drizzle + `resolvePermissions` leyendo columnas reales + agrupación por `(scope, scope_id)` donde aplique.

---

## Corrección 3 — `administracion`: una sola app `is_management`

| Estado en SAMI v2 | **No aplica al seed actual** |
|-------------------|------------------------------|

El seed mínimo no incluye las cuatro apps de administración. Solo `sami-platform` tiene `is_management: true` y su `module_slug` es `platform`, sin conflicto con el índice parcial.

**Acción:** al añadir `gestion-usuarios`, `roles-global`, etc., **máximo una** fila con `is_management = true` por `module_slug` (resto `false`), tal como indica el documento de correcciones.

---

## Corrección 4 — Ruta consistente de seeds

| Estado en SAMI v2 | **Convención híbrida explícita** |
|-------------------|----------------------------------|

- Entrada: `src/core/database/seed-rbac.ts` (y `seed.ts` en la misma carpeta).
- Lógica RBAC: `src/core/database/seeds/rbac.seed.ts`.

Los scripts en `package.json` apuntan correctamente a `seed-rbac.ts` en `database/`. No hay error de “file not found”.

**Conclusión:** No es obligatorio mover archivos; basta con **documentar** la convención (este archivo + fase 02).

---

## Corrección 5 — `module_slug` en `app_roles` e `isModuleAdmin`

| Estado en SAMI v2 | **Ya cubierto** |
|-------------------|-----------------|

- Backend: `GET /auth/me` ya incluye `module_slug` por asignación (vía `CachedAssignment.moduleSlug` y mapeo en `AuthService`).
- Frontend: `isModuleAdmin` en `permissions.ts` usa **`r.moduleSlug === moduleSlug`**, no `appSlug.startsWith(...)`.

El fragmento “ANTES” del documento externo **no coincide** con nuestro código actual (posiblemente era otro branch o un ejemplo genérico).

---

## Opinión propia (Cursor)

1. **Prioridad:** alinear **`.kiro/specs/sami-rbac/`** con las decisiones de negocio (sin `he-registrador`, `scope_id` como código SAP) para que implementación, seeds futuros y tests no diverjan.
2. **`scope_id` UUID en Kiro:** tratarlo como **error de modelado** respecto a SAP; la corrección VARCHAR es la adecuada.
3. **No reescribir el seed mínimo** solo para cumplir el listado de 7 roles globales hasta que el producto pida el catálogo completo; sí **anotar** las reglas (1 management por módulo, roles HE) en el spec y en el seed ampliado.

## Próximos pasos sugeridos (cuando se retome RBAC “completo”)

1. Migración: `scope` + `scope_id` (`varchar(20)`), y eventualmente `revoked_at` si se sigue Kiro al pie de la letra.
2. Actualizar `resolvePermissions` / agrupación de caché.
3. Ampliar seed con apps `administracion` respetando un único `is_management: true`.
4. PR en `.kiro` para `he-registrador` y tipo de `scope_id`.
