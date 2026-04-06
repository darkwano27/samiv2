-- Código SAP del jefe inmediato en maestro `eiis_trabajadores` (réplica / staging).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'eiis_trabajadores'
  ) THEN
    ALTER TABLE "eiis_trabajadores" ADD COLUMN IF NOT EXISTS "jefe" varchar(32);
  END IF;
END $$;
