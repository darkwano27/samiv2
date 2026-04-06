import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * SMTP por módulo (Salud Ocupacional, etc.). La contraseña va cifrada (`smtp_pass_encrypted`).
 */
export const moduleSmtpSettings = pgTable('module_smtp_settings', {
  moduleSlug: varchar('module_slug', { length: 100 }).primaryKey(),
  smtpHost: varchar('smtp_host', { length: 255 }).notNull(),
  smtpPort: integer('smtp_port').notNull().default(587),
  mailSecure: boolean('mail_secure').notNull().default(false),
  smtpUser: varchar('smtp_user', { length: 320 }),
  smtpFrom: varchar('smtp_from', { length: 320 }).notNull(),
  smtpPassEncrypted: text('smtp_pass_encrypted'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
