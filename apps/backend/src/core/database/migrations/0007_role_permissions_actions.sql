ALTER TABLE "role_permissions" ADD COLUMN "actions" text[];
UPDATE "role_permissions" SET "actions" = ARRAY['read']::text[] WHERE "actions" IS NULL;
ALTER TABLE "role_permissions" ALTER COLUMN "actions" SET NOT NULL;
ALTER TABLE "role_permissions" ALTER COLUMN "actions" SET DEFAULT ARRAY['read']::text[];
--> statement-breakpoint
INSERT INTO "apps" ("slug", "module_slug", "label", "is_management")
VALUES
  ('inventario-medico', 'salud-ocupacional', 'Inventario médico', false),
  ('reportes-so', 'salud-ocupacional', 'Reportes SO', false)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "app_features" ("app_id", "slug", "label")
SELECT a."id", 'inventario', 'Gestión de inventario'
FROM "apps" a WHERE a."slug" = 'inventario-medico'
ON CONFLICT ("app_id", "slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "app_features" ("app_id", "slug", "label")
SELECT a."id", 'ver', 'Consulta de reportes'
FROM "apps" a WHERE a."slug" = 'reportes-so'
ON CONFLICT ("app_id", "slug") DO NOTHING;
