-- Persiste las acciones elegidas en el modal (intención del usuario).
-- El rol resuelto puede incluir permisos extra; sin esta columna el GET mostraba la unión del rol.
ALTER TABLE "module_profiles" ADD COLUMN IF NOT EXISTS "app_permissions_json" jsonb;
