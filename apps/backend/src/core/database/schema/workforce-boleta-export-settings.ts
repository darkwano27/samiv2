import { integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * Destino para depositar CSV de boletas (SFTP o carpeta de red SMB).
 * Una fila por módulo (`horas-extra`).
 */
export const workforceBoletaExportSettings = pgTable('workforce_boleta_export_settings', {
  moduleSlug: varchar('module_slug', { length: 100 }).primaryKey(),
  protocol: varchar('protocol', { length: 16 }).notNull().default('sftp'),
  host: varchar('host', { length: 255 }).notNull().default(''),
  port: integer('port').notNull().default(22),
  remotePath: text('remote_path').notNull().default('/'),
  shareName: varchar('share_name', { length: 512 }),
  username: varchar('username', { length: 320 }),
  passwordEncrypted: text('password_encrypted'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
