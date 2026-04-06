import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Fila mínima por `pernr` (código SAP) para FKs RBAC. La identidad y el maestro viven en SAP staging;
 * esta tabla se rellena/actualiza al asignar roles (y en seed), no reemplaza al maestro.
 */
export const workers = pgTable('workers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
