import { integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * MySQL GLPI (solo lectura desde SAMI). Contraseña cifrada (`glpi_db_pass_encrypted`).
 * Una fila por `module_slug` (p. ej. `sistemas`).
 */
export const moduleGlpiSettings = pgTable('module_glpi_settings', {
  moduleSlug: varchar('module_slug', { length: 100 }).primaryKey(),
  dbHost: varchar('glpi_db_host', { length: 255 }).notNull(),
  dbPort: integer('glpi_db_port').notNull().default(3306),
  dbUser: varchar('glpi_db_user', { length: 160 }).notNull(),
  dbName: varchar('glpi_db_name', { length: 128 }).notNull(),
  dbPassEncrypted: text('glpi_db_pass_encrypted'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
