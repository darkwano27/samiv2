/**
 * Consulta GLPI — inventarios genericobject + campos adicionales (plugin Fields).
 * El nombre `fechadeasignacinfieldfourfour` viene del despliegue GLPI (custom field interno).
 */
export const GLPI_SQL_ASSETS_BY_USER_ID = `
SELECT
  i.id,
  i.name,
  i.serial,
  c.name AS categoria,
  t.name AS tipo,
  m.name AS marca,
  mo.name AS modelo,
  fi.fechadeasignacinfieldfourfour AS fecha_asignacion
FROM glpi_plugin_genericobject_inventarios i
LEFT JOIN glpi_plugin_fields_plugingenericobjectinventarioaddinventarios fi
  ON fi.items_id = i.id
LEFT JOIN glpi_plugin_fields_categoriafielddropdowns c
  ON fi.plugin_fields_categoriafielddropdowns_id = c.id
LEFT JOIN glpi_plugin_fields_tipofielddropdowns t
  ON fi.plugin_fields_tipofielddropdowns_id = t.id
LEFT JOIN glpi_plugin_fields_marcafielddropdowns m
  ON fi.plugin_fields_marcafielddropdowns_id = m.id
LEFT JOIN glpi_plugin_fields_modelofielddropdowns mo
  ON fi.plugin_fields_modelofielddropdowns_id = mo.id
WHERE i.users_id = ?
ORDER BY fi.fechadeasignacinfieldfourfour DESC
LIMIT 50
`.trim();

export const GLPI_SQL_USER_BY_REGISTRATION = `
SELECT id, name, firstname, realname, registration_number
FROM glpi_users
WHERE registration_number = ?
LIMIT 1
`.trim();

export const MODULE_SLUG_SISTEMAS = 'sistemas' as const;
