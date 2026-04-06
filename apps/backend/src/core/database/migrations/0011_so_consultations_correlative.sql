-- Número correlativo visible para el usuario (ficha PDF / modal), independiente del UUID interno.

CREATE SEQUENCE IF NOT EXISTS so_consultations_correlative_seq;

ALTER TABLE "so_consultations" ADD COLUMN IF NOT EXISTS "correlative" integer;

UPDATE "so_consultations" c
SET "correlative" = s.rn
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at ASC) AS rn
  FROM "so_consultations"
) s
WHERE c.id = s.id AND c."correlative" IS NULL;

UPDATE "so_consultations"
SET "correlative" = nextval('so_consultations_correlative_seq')
WHERE "correlative" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_so_consultations_correlative" ON "so_consultations" ("correlative");

ALTER TABLE "so_consultations"
  ALTER COLUMN "correlative" SET DEFAULT nextval('so_consultations_correlative_seq'),
  ALTER COLUMN "correlative" SET NOT NULL;

ALTER SEQUENCE so_consultations_correlative_seq OWNED BY "so_consultations"."correlative";

SELECT setval(
  'so_consultations_correlative_seq',
  COALESCE((SELECT MAX("correlative") FROM "so_consultations"), 1)
);
