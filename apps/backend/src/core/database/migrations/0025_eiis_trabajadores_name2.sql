-- Apellido materno / segundo apellido en maestro `eiis_trabajadores` (réplica SAP).
-- La tabla la provee el staging; solo aseguramos la columna si aún no existe.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'eiis_trabajadores'
  ) THEN
    ALTER TABLE "eiis_trabajadores" ADD COLUMN IF NOT EXISTS "name2" text;
  END IF;
END $$;
