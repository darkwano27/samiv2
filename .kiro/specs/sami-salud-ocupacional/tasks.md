# Implementation plan — Salud Ocupacional

## Overview

Orden sugerido para implementar el módulo en `sami-V2`: schema y migración primero, servicio y API, PDF/email, luego frontend por app. Cada tarea referencia **requirements** del spec hermano.

---

## Tasks

- [ ] **1. Schema Drizzle `so_*` en `public`**
  - Ubicación sugerida: `apps/backend/src/core/database/schema/salud-ocupacional/` (un archivo por tabla o `index` que reexporte).
  - Tablas: `so_diagnoses`, `so_medicines`, `so_consultations`, `so_consultation_diagnoses`, `so_prescriptions` con prefijos e índices del design.
  - PK `uuid` + `defaultRandom()`; `created_by` → `workers.id` (text).
  - _Req: 1.1–1.3, design tablas_

- [ ] **2. Migración SQL**
  - `drizzle-kit generate` / aplicar migración; verificar CASCADE y UNIQUE en N:N diagnósticos.
  - _Req: 1_

- [ ] **3. Módulo Nest `SaludOcupacionalModule`**
  - `apps/backend/src/modules/salud-ocupacional/`
  - Registrar en `AppModule`; inyectar `SAMI_DB` y `SAP_DB` (opcional null) como en admin/auth.

- [ ] **4. DTOs Zod**
  - Crear consulta, diagnóstico, medicamento, send-email; alinear enums (alta, presentación, vía, frecuencias) con requirements del spec fuente Kiro v01 donde aplique.
  - _Req: 5, 9.2_

- [ ] **5. Service — SAP search y catálogos**
  - `sapSearch`, `getDiagnoses`, `createDiagnosis`, `getMedicines`, `searchMedicines`, `createMedicine`.
  - _Req: 3, 4_

- [ ] **6. Service — CRUD consulta**
  - `createConsultation` transaccional; snapshot prescripciones; validación diagnosisIds.
  - _Req: 5_

- [ ] **7. Service — historial, mis consultas, detalle**
  - Paginación, filtros, `getMyConsultations` por **`patient_cod` = sesión** (paciente), `getById` con regla OR de permisos.
  - _Req: 7, 8, 2.3_

- [ ] **8. PDF builder + endpoints PDF**
  - Builder dedicado; `GET .../:id/pdf` con headers de descarga.
  - _Req: 6_

- [ ] **9. Email send + endpoint**
  - Reutilizar EmailService; manejo de error acorde (no tumbar cliente si el spec pide soft-fail en fallo SMTP).
  - _Req: 6_

- [ ] **10. Export TSV**
  - `export-tsv` con BOM; filas por prescripción; enriquecimiento SAP según columnas disponibles en réplica.
  - _Req: 7_

- [ ] **11. Controller + guards RBAC**
  - Mapear cada ruta a `@RequirePermission` (o patrón actual del backend) con features sembradas.
  - Implementar helper **OR** para detalle/PDF si no existe en el framework de guards.
  - _Req: 2, 9_

- [ ] **12. Seed RBAC SO (features mínimas)**
  - Extender `seed:rbac` o script: features bajo `registro-consulta`, `historial-medico`, `mis-consultas` y vínculos `role_permissions` para roles de prueba (p. ej. viewer por app o rol de dominio SO).
  - Documentar slugs en `docs/features/` breve.
  - _Req: 2_

- [x] **12b. Ajustes SO — roles en alcance módulo**
  - API `GET|POST|DELETE` bajo `/api/salud-ocupacional/module-settings/*` + guard módulo; métodos en `AdminService` filtrados por `module_slug`.
  - UI `/salud-ocupacional/ajustes` (pestaña roles operativa; correo placeholder); nav `salud-ocupacional-ajustes`; docs `docs/features/so-module-settings-api.md` + spec Kiro actualizado.
  - _Req: 2.5_

- [ ] **13. Frontend — registro consulta**
  - Conectar ruta existente a vista real; formulario, modales, firma, mutaciones TanStack Query.
  - _Req: 10_

- [ ] **14. Frontend — historial médico**
  - Tabla, filtros, selección, export, drawer, PDF.
  - _Req: 10, 7_

- [ ] **15. Frontend — mis consultas**
  - Cards, drawer, PDF.
  - _Req: 10, 8_

- [ ] **16. Auditoría (opcional / fase 2)**
  - Tabla global o `so_audit_events`; insert en create y email.
  - _Req: 5.6, design auditoría_

- [ ] **17. Tests**
  - Unit: servicio creación, validación Zod, snapshot prescripción.
  - E2E manual: checklist en `docs/` si aplica.

---

## Notes

- Mantener **solo** tablas `so_*` para datos de dominio SO en esta fase.
- Revisar campos SAP reales (`name2`, CECO, etc.) antes de cerrar contrato del export.
- Si el equipo prefiere **cuid2** en lugar de uuid, actualizar design + tarea 1 de forma consistente.
