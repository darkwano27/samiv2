# Requirements — Módulo Salud Ocupacional (SAMI v2)

## Introduction

El módulo **Salud ocupacional** permite al personal autorizado registrar **consultas médicas ocupacionales**, administrar **catálogos** de diagnósticos y medicamentos, generar **fichas en PDF**, **enviar por correo** y consultar **historial global** o **mis consultas**. Vive en el monorepo `sami-V2`; los datos clínicos persisten en **PostgreSQL `public`** con **prefijo de tabla `so_`** para identificar el dominio sin usar un schema SQL separado.

**Alineación SAMI v2:** identidad del trabajador = **`sap_code` / `pernr`**; `created_by` y referencias a worker usan el mismo texto que `workers.id`. Control de acceso vía **apps y features RBAC** del catálogo (`registro-consulta`, `historial-medico`, `mis-consultas`, etc.), no el vocabulario legacy `so_* .canCreate` del spec fuente.

---

## Glossary

- **SO_Module**: Dominio funcional Salud ocupacional en SAMI v2.
- **SO_Table**: Tabla en `public` cuyo nombre comienza por `so_`.
- **Consultation**: Atención registrada en `so_consultations`.
- **Diagnosis / Medicine**: Filas de catálogo en `so_diagnoses` / `so_medicines`.
- **Prescription**: Línea de receta en `so_prescriptions` con **snapshot inmutable** del medicamento al momento de prescribir.
- **SAP_Staging**: Base/conexión de solo lectura (`SAP_DB`), p. ej. `eiis_trabajadores`.
- **SAMI_DB**: Base de aplicación donde viven `so_*`, `workers`, RBAC, etc.

---

## Requirements

### Requirement 1: Convención de nombres en `public`

**User Story:** Como equipo de plataforma, quiero que las tablas del módulo SO se distingan claramente en un único schema `public`, para evitar colisiones y facilitar migraciones y permisos.

#### Acceptance Criteria

1. THE SO_Module SHALL crear todas sus tablas de dominio con nombre **`so_*`** (ej. `so_consultations`, `so_diagnoses`).
2. THE SO_Module SHALL usar índices y constraints cuyos nombres incluyan el prefijo **`so_`** o **`idx_so_`** de forma consistente.
3. THE SO_Module SHALL NOT require a separate PostgreSQL schema for SO unless explicitly decided later; the **`so_` prefix** is the primary namespace convention.

---

### Requirement 2: RBAC (alto nivel)

**User Story:** Como administrador, quiero que cada app SO esté gobernada por el RBAC existente de SAMI v2.

#### Acceptance Criteria

1. THE SO_Module SHALL map HTTP y rutas UI a **apps** ya previstas en navegación: `registro-consulta`, `historial-medico`, `mis-consultas` (módulo `salud-ocupacional`).
2. THE SO_Module SHALL use **features** por app (slugs estables, p. ej. lectura de listados, creación de consulta, exportación) y acciones `read` / `create` / … según el modelo RBAC del monorepo.
3. THE SO_Module SHALL allow **lectura de detalle de consulta y PDF** si el usuario tiene **cualquiera** de los permisos de lectura pertinentes entre registro, historial y mis consultas (equivalente lógico a evaluación OR / “Promise.any” del spec fuente).
4. THE SO_Module SHALL defer el listado exacto de features y seeds al diseño de catálogo RBAC y tarea `seed:rbac` / migraciones; este spec define **comportamiento**, no nombres legacy `so_registro_consulta.canCreate`.
5. THE SO_Module SHALL expose a module **Ajustes** entry (ruta UI y slug de navegación acordados) para administradores del módulo: gestión de **asignaciones de roles** cuyas apps pertenezcan a `salud-ocupacional`, sin sustituir el panel **superadmin** global (`/api/admin/*`). La configuración de **correo** para PDFs puede compartir la misma pantalla en una segunda pestaña cuando exista backend.

---

### Requirement 3: Búsqueda de trabajadores (SAP)

1. WHEN el usuario busca paciente para una consulta, THE SO_Module SHALL consultar **solo `SAP_DB`** (read-only) sobre datos de trabajadores alineados a `eiis_trabajadores`.
2. THE SO_Module SHALL limitar resultados (p. ej. máx. 15) y **priorizar activos** (`stat2` coherente con el resto del backend).
3. THE Frontend SHALL debounce la búsqueda (p. ej. 300 ms).

---

### Requirement 4: Catálogos diagnósticos y medicamentos

1. THE SO_Module SHALL listar solo ítems **activos** (`is_active = true`) en diagnósticos y medicamentos.
2. THE SO_Module SHALL permitir **crear** diagnóstico (nombre único, código CIE-10 opcional) y medicamento (presentación, concentración, vía, unidad de inventario según enums acordados).
3. THE SO_Module SHALL proteger altas de catálogo con RBAC de la app **registro-consulta** (feature de creación / administración de catálogo).

---

### Requirement 5: Registro de consulta

1. THE SO_Module SHALL persistir consulta en **`so_consultations`** con snapshot de datos de paciente relevantes y **`created_by` = `sap_code`** del usuario autenticado.
2. THE SO_Module SHALL exigir **al menos un diagnóstico** vinculado; validar que todos los IDs existan en `so_diagnoses`.
3. THE SO_Module SHALL persistir prescripciones en **`so_prescriptions`** con **copia inmutable** de nombre, presentación, concentración y vía del medicamento al momento de prescribir.
4. THE SO_Module SHALL aceptar solo **`discharge_condition`** en el conjunto cerrado acordado (p. ej. `observacion`, `recuperado`, `derivado`).
5. THE SO_Module SHALL soportar **firma** como datos base64 (texto) en la consulta.
6. THE SO_Module SHOULD registrar evento de auditoría de negocio al crear consulta cuando exista tabla o pipeline de auditoría en el monorepo (ver tareas).

---

### Requirement 6: PDF y correo

1. THE SO_Module SHALL generar PDF de ficha (p. ej. pdfmake) con secciones: cabecera institucional, paciente, atención, diagnósticos, receta, firma, pie con identificador.
2. THE SO_Module SHALL exponer descarga con `Content-Type` PDF y nombre de archivo estable (patrón: código paciente + apellido/nombre abreviado + fecha).
3. THE SO_Module SHALL enviar correo con PDF adjunto según destinatarios indicados, usando el **EmailService** global del backend si está disponible.
4. THE SO_Module SHALL proteger envío de correo con RBAC acorde (típicamente misma app que creación de consulta).

---

### Requirement 7: Historial y exportación

1. THE SO_Module SHALL listar consultas con **paginación**, búsqueda por texto (nombre/código paciente) y filtro por rango de fechas sobre fecha de atención.
2. THE SO_Module SHALL exportar datos en formato **TSV con BOM UTF-8** para Excel, con opción de filtrar por IDs seleccionados o por mismos filtros del listado.
3. THE SO_Module SHALL enriquecer export con campos SAP cuando estén disponibles en staging (columnas exactas según diseño técnico y réplica real).
4. THE SO_Module SHALL require RBAC de app **historial-medico** para historial y export.

---

### Requirement 8: Mis consultas

1. THE SO_Module SHALL listar solo consultas donde el **paciente** es el usuario actual: **`patient_cod` = `sap_code` de sesión** (mismo criterio para lectura de detalle con permiso app `mis-consultas`), paginado y con filtro de fechas sobre `attention_date`.
2. THE UI SHALL presentar el listado de forma clara (tabla o cards) indicando que son atenciones en las que el usuario figura como paciente.

### Requirement 8b: Inventario médico (catálogo)

1. THE SO_Module SHALL exponer lectura de catálogo completo (activos e inactivos) y **PATCH** para editar o desactivar (`is_active`) diagnósticos y medicamentos bajo rutas `.../consultations/inventario/...`.
2. THE SO_Module SHALL aceptar para esas escrituras permiso RBAC **`update` o `delete`** sobre la feature `inventario` de la app `inventario-medico` (p. ej. baja lógica con solo `delete`).

---

### Requirement 9: API y rutas HTTP

1. THE SO_Module SHALL colgar endpoints bajo un prefijo claro, p. ej. **`/api/salud-ocupacional/`** (o subruta `.../consultations/...`), para no colisionar con otros dominios.
2. THE SO_Module SHALL validar bodies con **Zod** y usar pipes/guards alineados al resto del backend NestJS.

---

### Requirement 10: Frontend

1. THE Frontend SHALL implementar vistas alineadas a rutas existentes bajo `salud-ocupacional/` (`registro-consulta`, `historial-medico`, `mis-consultas`).
2. THE Frontend SHALL usar **TanStack Query**, componentes UI del design system del monorepo, y comprobar acceso con helpers RBAC (`canAccess` / flags) cuando estén activos.

---

## Out of scope (fase inicial)

- Apps placeholder del mismo módulo (`descanso-medico`, `reportes-so`) sin requisitos detallados en este spec (inventario médico: ver Requirement 8b).
- Schema SQL separado `salud_ocupacional` (opcional futuro; no requerido si se mantiene `so_`).
