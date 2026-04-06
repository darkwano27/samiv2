import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Credenciales locales solo para workers sin AD (correo_corp vacío en SAP staging). */
export const localAuth = pgTable('local_auth', {
  sapCode: varchar('sap_code', { length: 20 }).primaryKey(),
  passwordHash: text('password_hash').notNull(),
  isTempPassword: boolean('is_temp_password').default(false).notNull(),
  tempToken: uuid('temp_token'),
  tempTokenExpiresAt: timestamp('temp_token_expires_at', { withTimezone: true }),
  /** Intentos fallidos de contraseña consecutivos (solo login local). */
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
  /** Si está en el futuro, el login local rechaza hasta que expire o un admin desbloquee. */
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
