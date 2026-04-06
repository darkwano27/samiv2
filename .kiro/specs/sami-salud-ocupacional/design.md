# Design — Salud Ocupacional (SAMI v2)

## Overview

Módulo clínico-ocupacional con datos en **`public`**, tablas prefijadas **`so_`**, lectura de maestros en **`SAP_DB`**, escrituras en **`SAMI_DB`**. Tres líneas de producto principales: **registrar consulta**, **historial médico**, **mis consultas**, más PDF, email y export TSV.

---

## Namespace en PostgreSQL (`public`)

| Enfoque | Uso en SAMI v2 SO |
|--------|-------------------|
| **Prefijo `so_` en nombres de tabla** | Recomendado: identifica el dominio sin cambiar `search_path` ni permisos por schema. |
| **Schema dedicado** (`salud_ocupacional`) | Posible más adelante; hoy **no** es requisito si todas las tablas son `so_*`. |

**Observación:** El prefijo no sustituye documentación; migraciones y seeds deben agrupar solo objetos `so_%`.

---

## Decisiones técnicas

- **PKs de entidades SO:** `uuid` con `defaultRandom()` para alinear con tablas RBAC en el mismo `public` (alternativa documentada: `varchar(128)` + cuid2 si se exige longitud/opacidad distinta).
- **`created_by`:** `text` / `varchar`, **mismo valor que `sap_code` / `workers.id`**, FK a `workers(id)` si la política del monorepo exige fila en `workers` (creación lazy al primer hecho relevante, como en asignaciones RBAC).
- **`patient_cod`:** `pernr` SAP; **no** FK a SAP (réplica externa); índice para búsquedas e informes.
- **Prescripciones:** columnas snapshot duplicadas del medicamento; **no** actualizar snapshot si cambia el catálogo.
- **Dual DB:** búsqueda paciente y enriquecimiento export → `SAP_DB`; resto → `SAMI_DB`.

---

## Tablas (Drizzle / SQL lógico)

Nombres físicos en **`public`**:

| Tabla | Rol |
|-------|-----|
| `so_diagnoses` | Catálogo diagnósticos (`name` unique, `code` opcional, `is_active`). |
| `so_medicines` | Catálogo medicamentos (presentación, concentración, vía, unidad inventario, `is_active`). |
| `so_consultations` | Cabecera consulta (datos paciente snapshot, fechas, motivo, alta, emails, firma, `created_by`, etc.). |
| `so_consultation_diagnoses` | N:N consulta ↔ diagnóstico; `UNIQUE (consultation_id, diagnosis_id)`; `ON DELETE CASCADE` desde consulta. |
| `so_prescriptions` | Líneas de receta; FK `medicine_id` + snapshot; `ON DELETE CASCADE` desde consulta. |

Índices mínimos sugeridos: `so_consultations(patient_cod)`, `so_consultations(created_by)`, `so_consultations(attention_date)`, `so_medicines(name)`, `so_prescriptions(consultation_id)`.

---

## API HTTP (propuesta)

Prefijo base: **`/api/salud-ocupacional`**.

| Método | Ruta propuesta | Notas |
|--------|----------------|-------|
| `GET` | `.../consultations/sap-search` | Query `q`; límite y orden activos. |
| `GET` | `.../consultations/diagnoses` | Solo activos. |
| `POST` | `.../consultations/diagnoses` | Alta catálogo. |
| `GET` | `.../consultations/medicines` | Solo activos. |
| `GET` | `.../consultations/medicines/search` | `q` mín. longitud. |
| `POST` | `.../consultations/medicines` | Alta catálogo. |
| `POST` | `.../consultations` | Crear consulta transaccional. |
| `GET` | `.../consultations/historial` | Paginación + filtros. |
| `GET` | `.../consultations/historial/export-tsv` | BOM + TSV; query params acordados. |
| `GET` | `.../consultations/my` | Solo `patient_cod = session.sap` (paciente = usuario logueado); filtros de fecha opcionales. |
| `PATCH` | `.../consultations/inventario/diagnoses/:id` | Catálogo; permiso `update` o `delete` en feature `inventario`. |
| `PATCH` | `.../consultations/inventario/medicines/:id` | Ídem. |
| `GET` | `.../consultations/:id` | Detalle; permiso OR entre apps/features de lectura. |
| `GET` | `.../consultations/:id/pdf` | Misma regla OR que detalle. |
| `POST` | `.../consultations/:id/send-email` | Body `emailTo`, `emailCc[]`. |

Los **guards** concretos (`@RequirePermission` o equivalente) se enlazan a **feature slugs** definidos en seed RBAC (ver `tasks.md`).

---

## RBAC — mapeo conceptual (sin nombres legacy)

| App (slug) | Capacidades típicas (features) |
|------------|---------------------------------|
| `registro-consulta` | buscar SAP, leer catálogos, crear catálogo, crear consulta, leer detalle propio/ajeno si aplica, PDF, email. |
| `historial-medico` | listar historial, export TSV, leer detalle, PDF. |
| `mis-consultas` | listar consultas donde el usuario es **paciente** (`patient_cod`), leer detalle/PDF si aplica la misma regla OR que el resto. |

**Lectura cruzada (detalle/PDF):** el servicio debe considerar concedido si `canAccess` es verdadero para **alguna** de las features de lectura de detalle definidas en esas apps (implementación: múltiples chequeos OR en guard o helper dedicado).

**Module admin:** app `salud-ocupacional-gestion` / rol `module-admin` sigue las reglas globales RBAC del monorepo.

### Ajustes (UI) vs app de catálogo RBAC

- En **navegación** la entrada se llama **Ajustes** (`slug` de sidebar: `salud-ocupacional-ajustes`, ruta `/salud-ocupacional/ajustes`). El acceso sigue `canAccessApp`: superadmin, rol explícito sobre esa entrada, o **`managed_module_slugs` que incluya `salud-ocupacional`** (p. ej. quien tiene `module-admin` en `salud-ocupacional-gestion`).
- En **catálogo RBAC** la app de gestión del módulo sigue siendo **`salud-ocupacional-gestion`** (`is_management: true`). No se duplica una segunda app solo por el nombre “Ajustes”.
- **API de módulo** (alcance SO, no superadmin global): `GET|POST|DELETE` bajo `/api/salud-ocupacional/module-settings/*` documentado en `docs/features/so-module-settings-api.md`. Superadmin también puede usarla.
- **Acciones RBAC:** `role_permissions.actions` (`text[]`) define `read` / `create` / `update` / `delete` por celda matriz; ver `docs/features/rbac-role-permissions-actions.md`.

---

## Frontend — layout de carpetas sugerido

```
apps/frontend/src/modules/salud-ocupacional/
├── registro-consulta/     # vista + componentes (SapSearch, modales, firma, …)
├── historial-medico/      # tabla, filtros, drawer, export
├── mis-consultas/         # cards, drawer
├── ajustes/               # pestañas: roles (módulo), correo (placeholder)
├── api/ o repository/     # cliente HTTP al prefijo salud-ocupacional
└── types/
```

Rutas TanStack Router: `registro-consulta`, `historial-medico`, `mis-consultas`, `ajustes`, etc.

---

## Auditoría

Eventos deseables: `CONSULTATION_CREATED`, `CONSULTATION_EMAIL_SENT`. Si aún no existe tabla global `audit_log` en el monorepo, **fase 1** puede omitir persistencia y dejar hook/TODO en servicio, o tabla **`so_audit_events`** mínima solo SO (decisión en implementación).

---

## Dependencias

- **pdfmake** (o la librería PDF ya estandarizada en el monorepo).
- **EmailModule / EmailService** existente.
- **Drizzle** migraciones en `apps/backend`.
- Sin nuevas dependencias obligatorias salvo decisión explícita del equipo.

---

## Fuentes

Spec funcional detallado previo: `Proyecto/Kiro/sami-spec.v01/.kiro/specs/sami-salud-ocupacional/`. Este documento **recorta** permisos legacy y fija namespace **`so_`** + prefijo API para `sami-V2`.
