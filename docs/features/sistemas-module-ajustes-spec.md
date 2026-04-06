# Módulo Sistemas — Ajustes, miembros, perfiles, correo e integración GLPI

> Especificación de producto y técnica para extender **SAMI v2** sin rehacer lo ya maduro en Salud ocupacional.  
> Contexto v1 (equipos / GLPI / PDF): documento externo `sistemas_module_spec.md` (monorepo legado).  
> Patrón de referencia en v2: [`so-module-settings-api.md`](./so-module-settings-api.md) y [`module-email-pdf-architecture.md`](./module-email-pdf-architecture.md).

---

## 1. Objetivo

Incorporar en el módulo **Sistemas** una aplicación **Ajustes** que permita a **administradores del módulo** (`module-admin` en la app de gestión + `managed_module_slugs` que incluya `sistemas`) y a **superadmin**:

1. **Gestionar miembros** del módulo (alta por SAP, perfiles plantilla, detalle, revocación), con **misma experiencia y reglas** que en Salud ocupacional.
2. **Gestionar perfiles** del módulo (plantillas RBAC: crear, editar, eliminar cuando no haya miembros; perfiles semilla de sistema protegidos).
3. **Configurar correo SMTP del módulo** (envío de PDFs / notificaciones propias de Sistemas), reutilizando el modelo de **SMTP por módulo** ya usado en SO.
4. **Configurar la integración GLPI** (conexión de solo lectura y parámetros operativos), de forma **persistente y auditada**, sin sustituir de golpe el modo v1 basado solo en variables de entorno hasta que exista migración clara.

No sustituye **`/api/admin/*`**: catálogo global, superadmin y correo **sistema** siguen como hoy ([`rbac-admin-api.md`](./rbac-admin-api.md)).

---

## 2. Estado actual en SAMI v2 (referencia)

| Área | Situación |
|------|-----------|
| Navegación | Módulo `sistemas` con apps: asignación de bienes, registro de productividad, mis equipos (`navigation-config.ts`). **No** existe entrada **Ajustes**. |
| RBAC seed | App **`sistemas-gestion`** (`rbac.seed.ts`): base para rol `module-admin` del módulo. |
| API module-settings | Solo **`salud-ocupacional/module-settings`**. No hay prefijo análogo bajo `sistemas/`. |
| GLPI / equipos | En v1: MySQL + endpoints `equipment/*`. En v2: **pendiente de portar** según spec legado; este documento no duplica el detalle SQL de GLPI. |

---

## 3. Alcance funcional — Ajustes Sistemas

### 3.1 Pestañas de la vista (orden sugerido)

| Pestaña | Contenido | Paridad con SO |
|---------|-----------|----------------|
| **Miembros** | Resumen por perfil, formulario agregar miembro (SAP + lookup), tabla paginada, sheet de detalle | Sí (mismo flujo UX) |
| **Perfiles** | Tarjetas de perfiles, crear/editar/eliminar, notas de alcance por app | Sí |
| **Correo** | SMTP del módulo `sistemas`, guardar cifrado, prueba de envío | Sí ([`module-email-pdf-architecture.md`](./module-email-pdf-architecture.md)) |
| **Integración GLPI** *(nueva respecto a SO)* | Host, puerto, base, usuario de solo lectura, contraseña (cifrada), “Probar conexión”, opcional: timeout / notas | No existe en SO; específico de Sistemas |

La pestaña **Integración GLPI** puede llamarse **“GLPI”** o **“Integraciones”** en UI; el contrato API puede agruparse bajo `.../module-settings/glpi-settings` o `.../integrations/glpi`.

### 3.2 Comportamiento esperado — Miembros y perfiles

- **Búsqueda de trabajador**: mismo criterio que SO — **SAP staging + tabla local `workers`**, debounce, lista desplegable; al aplicar perfil se resuelve `worker_id` = `pernr` y se crea/actualiza stub si aplica (`AdminService` / flujo ya probado en SO).
- **Perfiles semilla**: definidos en seed RBAC para `sistemas` (análogo a `enfermera` / `jefe-so` en SO); **no eliminables**; edición de etiqueta/descripción según política del producto.
- **Perfiles custom**: `app_permissions` por app operativa del módulo; backend resuelve roles de catálogo con “mínimo exceso” como en SO.
- **Matriz de permisos** (opcional en primera iteración): `GET .../permission-matrix` filtrado a `module_slug = sistemas` si la UI lo necesita.

### 3.3 Acciones por aplicación (producto)

Definir en backend un mapa **por app del módulo `sistemas`**, análogo a `SO_PROFILE_ACTIONS_BY_APP_SLUG` en `AdminService`, por ejemplo:

| App (slug navegación / RBAC) | Acciones ofrecidas en el modal de perfil (ejemplo inicial) |
|------------------------------|------------------------------------------------------------|
| `asignacion-bienes` | `read`, `create` (PDF / envío según v1); ajustar cuando se porte el flujo completo |
| `mis-equipos` | `read` |
| `registro-productividad` | `read`, `create` (o solo `read` hasta existir pantalla) |

La tabla exacta debe cerrarse con negocio; este documento exige **explícitamente** el mapa en código para no mezclar reglas de SO.

---

## 4. API propuesta — `/api/sistemas/module-settings`

### 4.1 Autenticación y autorización

- Cookie **`sami_session`** válida.
- Guard **`SistemasModuleAdminGuard`** (espejo de `SaludOcupacionalModuleAdminGuard`): sesión válida **y** (`is_superadmin` **o** `managed_module_slugs` incluye **`sistemas`**).
- **401** / **403** como en SO.

### 4.2 Superficie HTTP (paridad con SO)

Reutilizar los mismos verbos y formas de body que en [`so-module-settings-api.md`](./so-module-settings-api.md), cambiando solo el prefijo:

`GET|POST|PATCH|DELETE /api/sistemas/module-settings/...`

Rutas alineadas 1:1 con SO:

- `rbac-catalog`, `profile-action-catalog`, `worker-lookup`, `members`, `members/:workerId`, `members/:workerId/profile`, `module-profiles`, `module-profiles/:id`, `permission-matrix`, `apply-profile`, `workers/:id/assignments`, `worker-assignments`, `assignments/:id`, `email-settings`, `email-settings/test`.

**Nuevas** (solo Sistemas):

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `.../glpi-settings` | Configuración no sensible + flags (`configured`, `last_test_at` opcional). Sin contraseña en claro. |
| `PATCH` | `.../glpi-settings` | Persistir host, puerto, database, user, password (opcional, cifrado con misma infra que SMTP), `connect_timeout_ms` opcional. |
| `POST` | `.../glpi-settings/test` | Abrir conexión de prueba (SELECT 1 o query mínima acordada); no exponer secretos en respuesta. |

Implementación recomendada: **`AdminService`** y servicios core ya parametrizados por `moduleSlug`; nuevo controlador **`sistemas-module-settings.controller.ts`** que delegue con `MODULE_SLUG = 'sistemas'`. Evitar copiar cientos de líneas: extraer helper o clase base cuando el segundo módulo esté estable.

### 4.3 Persistencia GLPI

- Tabla dedicada **o** reutilizar un esquema genérico `module_integration_settings` (`module_slug`, `integration_key`, `config_json` cifrado).  
- Criterio mínimo: **secretos cifrados** con la misma clave que SMTP de módulo (`SETTINGS_ENCRYPTION_KEY`), coherente con [`module-email-pdf-architecture.md`](./module-email-pdf-architecture.md).
- **Fallback**: si no hay fila en BD, el servicio de equipos puede leer **`GLPI_DB_*` del env** (comportamiento v1) para no romper despliegues existentes; la UI puede mostrar “Usando configuración del servidor (env)”.

---

## 5. Frontend

| Elemento | Detalle |
|----------|---------|
| Ruta | `/sistemas/ajustes` (o `/sistemas/gestion` si se prefiere otro path; debe ser único y estable). |
| Sidebar | Nueva app **`sistemas-ajustes`** en `MODULES`, con mapeo **`sistemas-ajustes` → `sistemas-gestion`** en `NAV_APP_TO_RBAC_APP` (igual que `salud-ocupacional-ajustes` → `salud-ocupacional-gestion`). |
| Código | Primera entrega: vista inspirada en `SoAjustesView` + repositorio `sistemas-module-settings.api-repository.ts`. Segunda fase: extraer componentes compartidos (`ModuleMembersTab`, `ModuleProfilesTab`, `ModuleEmailTab`) parametrizados por `moduleSlug` y URLs base. |
| Pestaña GLPI | Formulario con máscaras, botones Guardar / Probar conexión, mensajes de error neutros, sin volcar stack al cliente. |

---

## 6. RBAC y seed

- Confirmar en seed que existen **apps** del módulo `sistemas` alineadas con la navegación y con el **catálogo** que consume `profile-action-catalog`.
- Rol **`module-admin`** en **`sistemas-gestion`** debe seguir otorgando `managed_module_slugs: ['sistemas']` en `/auth/me` (mismo modelo que otros módulos).
- Documentar en [`rbac-role-permissions-actions.md`](./rbac-role-permissions-actions.md) si se agregan acciones nuevas.

---

## 7. Seguridad y operación

- Solo **admin módulo sistemas** y **superadmin** pueden leer/escribir GLPI SMTP de módulo y credenciales GLPI.
- Usuario GLPI: **solo lectura**; documentar en runbook que la contraseña no debe tener permisos de escritura.
- **Probar conexión**: timeout acotado; no loguear password.
- Redis / sesiones: sin cambio respecto al resto de la app; fallos de Redis afectan a toda la plataforma, no solo a este módulo.

---

## 8. Fases de implementación (checklist)

### Fase A — Paridad SO (sin GLPI persistido)

- [ ] `SistemasModuleAdminGuard` + `SistemasModule` (o equivalente) registrando `SistemasModuleSettingsController`.
- [ ] Endpoints `module-settings/*` con `moduleSlug = sistemas` reutilizando `AdminService`.
- [ ] Mapa `SISTEMAS_PROFILE_ACTIONS_BY_APP_SLUG` (nombre tentativo) en `AdminService`.
- [ ] Seed / catálogo: apps y perfiles semilla `sistemas` si faltan.
- [ ] Frontend: ruta, sidebar, pestañas Miembros / Perfiles / Correo.

### Fase B — GLPI en Ajustes

- [ ] Migración + entidad/tabla o JSON cifrado por módulo.
- [ ] `GET/PATCH/POST .../glpi-settings` (+ test).
- [ ] Servicio de equipos (cuando exista en v2) que lea **primero** BD y si no, **env**.

### Fase C — Refactor DRY

- [ ] Componentes y rutas genéricas opcionales (`moduleSlug` en ruta o factory de controladores).

---

## 9. Historial del documento

| Fecha | Cambio |
|-------|--------|
| 2026-04-05 | Versión inicial: alcance Ajustes Sistemas, paridad API/UI con SO, GLPI persistido + fallback env, fases. |

---

## 10. Referencias cruzadas

- API SO: [`so-module-settings-api.md`](./so-module-settings-api.md)  
- Correo y PDF: [`module-email-pdf-architecture.md`](./module-email-pdf-architecture.md)  
- Admin global: [`rbac-admin-api.md`](./rbac-admin-api.md)  
- Roadmap / evolución SO (contexto de madurez): [`so-gestion-roles-roadmap.md`](./so-gestion-roles-roadmap.md)  
- Spec v1 equipos (fuera del repo): `sistemas_module_spec.md`
