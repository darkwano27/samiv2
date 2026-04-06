-- Módulo Sistemas: apps operativas bajo module_slug sistemas + Ajustes (API module-settings).
-- `mis-equipos` pasa de `equipos` a `sistemas` para alinear con navegación y perfiles del módulo.

UPDATE apps SET module_slug = 'sistemas' WHERE slug = 'mis-equipos';

INSERT INTO apps (id, slug, module_slug, label, description, is_management, created_at)
VALUES
  (gen_random_uuid(), 'asignacion-bienes', 'sistemas', 'Asignación de bienes', NULL, false, now()),
  (gen_random_uuid(), 'registro-productividad', 'sistemas', 'Registro de productividad', NULL, false, now())
ON CONFLICT (slug) DO UPDATE SET
  module_slug = EXCLUDED.module_slug,
  label = EXCLUDED.label;
