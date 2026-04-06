import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * Microsoft Graph / SharePoint por módulo. Secreto de aplicación cifrado.
 * Valores vacíos en BD ⇒ se usa la variable de entorno homónima si existe.
 */
export const moduleSharepointSettings = pgTable('module_sharepoint_settings', {
  moduleSlug: varchar('module_slug', { length: 100 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }),
  clientId: varchar('client_id', { length: 128 }),
  clientSecretEncrypted: text('client_secret_encrypted'),
  sitePath: varchar('site_path', { length: 512 }),
  driveName: varchar('drive_name', { length: 128 }),
  parentFolder: varchar('parent_folder', { length: 512 }),
  publicHost: varchar('public_host', { length: 512 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
