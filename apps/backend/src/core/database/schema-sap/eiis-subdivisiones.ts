import { pgTable, text, varchar } from 'drizzle-orm/pg-core';

/**
 * Catálogo de subdivisiones (staging SAP).
 * `codigo_subdivision` alinea con `eiis_trabajadores.btrtl` (ej. 9040).
 */
export const eiisSubdivisiones = pgTable('eiis_subdivisiones', {
  codigoSubdivision: varchar('codigo_subdivision', { length: 20 }).primaryKey(),
  nombreSubdivision: text('nombre_subdivision').notNull(),
});
