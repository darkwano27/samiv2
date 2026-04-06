-- Campos adicionales del maestro SAP para snapshot en consultas SO (stext, ceco_dist, datin).
-- La tabla `eiis_trabajadores` no la crean las migraciones SAMI: viene del staging / réplica SAP.
-- En entornos sin esa tabla (p. ej. Postgres solo para desarrollo), no fallar el resto del pipeline.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'eiis_trabajadores'
  ) THEN
    ALTER TABLE "eiis_trabajadores" ADD COLUMN IF NOT EXISTS "stext" text;
    ALTER TABLE "eiis_trabajadores" ADD COLUMN IF NOT EXISTS "ceco_dist" varchar(64);
    ALTER TABLE "eiis_trabajadores" ADD COLUMN IF NOT EXISTS "datin" varchar(32);
  END IF;
END $$;
