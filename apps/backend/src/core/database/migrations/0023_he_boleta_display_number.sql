CREATE SEQUENCE IF NOT EXISTS "he_boleta_headers_display_number_seq";
--> statement-breakpoint
ALTER TABLE "he_boleta_headers" ADD COLUMN "display_number" integer NOT NULL DEFAULT nextval('he_boleta_headers_display_number_seq') UNIQUE;
--> statement-breakpoint
SELECT setval(
  'he_boleta_headers_display_number_seq',
  GREATEST((SELECT COALESCE(MAX("display_number"), 0) FROM "he_boleta_headers"), 1)
);
