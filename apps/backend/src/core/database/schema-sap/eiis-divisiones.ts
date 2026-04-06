import { pgTable, text, varchar } from 'drizzle-orm/pg-core';

/**
 * Catálogo de divisiones (staging SAP).
 * `codigo_division` alinea con `eiis_trabajadores.werks` (ej. AR90).
 */
export const eiisDivisiones = pgTable('eiis_divisiones', {
  codigoDivision: varchar('codigo_division', { length: 20 }).primaryKey(),
  nombreDivision: text('nombre_division').notNull(),
});
