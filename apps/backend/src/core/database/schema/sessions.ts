import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Sesiones en SAMI (auditoría + alineado al mapa: sap_code = pernr SAP).
 * La sesión activa sigue validándose también en Redis (cookie opaca).
 */
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  sapCode: text('sap_code').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
