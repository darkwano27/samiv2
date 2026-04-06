-- Snapshot de datos maestro SAP al momento del registro (export CSV / historial sin depender del join en frío).
-- cent_costo / fech_ingreso reservados cuando la réplica SAP exponga ceco / datin.

ALTER TABLE "so_consultations" ADD COLUMN IF NOT EXISTS "patient_establ" varchar(200);
ALTER TABLE "so_consultations" ADD COLUMN IF NOT EXISTS "patient_document_id" varchar(32);
ALTER TABLE "so_consultations" ADD COLUMN IF NOT EXISTS "patient_birth_date" varchar(32);
ALTER TABLE "so_consultations" ADD COLUMN IF NOT EXISTS "patient_cost_center" varchar(64);
ALTER TABLE "so_consultations" ADD COLUMN IF NOT EXISTS "patient_hire_date" varchar(32);
