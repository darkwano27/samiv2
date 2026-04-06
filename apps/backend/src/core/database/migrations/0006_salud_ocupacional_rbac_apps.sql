INSERT INTO "apps" ("slug", "module_slug", "label", "is_management")
VALUES
  ('registro-consulta', 'salud-ocupacional', 'Registro de consulta', false),
  ('historial-medico', 'salud-ocupacional', 'Historial médico', false)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
UPDATE "apps" SET "module_slug" = 'salud-ocupacional' WHERE "slug" = 'mis-consultas';
--> statement-breakpoint
INSERT INTO "app_features" ("app_id", "slug", "label")
SELECT a."id", 'operar', 'Registro, catálogos y consulta'
FROM "apps" a WHERE a."slug" = 'registro-consulta'
ON CONFLICT ("app_id", "slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "app_features" ("app_id", "slug", "label")
SELECT a."id", 'listar', 'Listar y exportar historial'
FROM "apps" a WHERE a."slug" = 'historial-medico'
ON CONFLICT ("app_id", "slug") DO NOTHING;
