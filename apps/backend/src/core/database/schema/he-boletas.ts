import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { workers } from './workers';

/** Pares werks + btrtl elegidos en el paso 1 (JSON). */
export type HeBoletaSubdivisionPair = { division_code: string; subdivision_code: string };

export const heBoletaHeaders = pgTable(
  'he_boleta_headers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdBy: text('created_by')
      .notNull()
      .references(() => workers.id, { onDelete: 'restrict' }),
    /** Número visible en bandeja e informes (secuencial por entorno). */
    displayNumber: integer('display_number')
      .notNull()
      .unique()
      .default(sql`nextval('he_boleta_headers_display_number_seq')`),
    /** Slug del grupo ARIS (p. ej. textil) para auditoría. */
    groupSlug: varchar('group_slug', { length: 64 }).notNull(),
    /** `werks` principal de la selección. */
    divisionCode: varchar('division_code', { length: 24 }).notNull(),
    subdivisionPairs: jsonb('subdivision_pairs').$type<HeBoletaSubdivisionPair[]>().notNull(),
    validFrom: varchar('valid_from', { length: 10 }).notNull(),
    validTo: varchar('valid_to', { length: 10 }).notNull(),
    timeStart: varchar('time_start', { length: 8 }).notNull(),
    timeEnd: varchar('time_end', { length: 8 }).notNull(),
    motivoCode: varchar('motivo_code', { length: 16 }),
    status: varchar('status', { length: 24 }).notNull().default('registrada'),
    /** SAP (`workers.id`) del usuario que aprobó en SAMI; firma PDF desde Mi firma. */
    approvedBy: text('approved_by').references(() => workers.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_he_boleta_headers_created_by').on(t.createdBy), index('idx_he_boleta_headers_created_at').on(t.createdAt)],
);

export const heBoletaLines = pgTable(
  'he_boleta_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    headerId: uuid('header_id')
      .notNull()
      .references(() => heBoletaHeaders.id, { onDelete: 'cascade' }),
    pernr: varchar('pernr', { length: 20 }).notNull(),
    workerName: varchar('worker_name', { length: 200 }),
    validFrom: varchar('valid_from', { length: 10 }).notNull(),
    validTo: varchar('valid_to', { length: 10 }).notNull(),
    days: integer('days').notNull(),
    timeStart: varchar('time_start', { length: 8 }).notNull(),
    timeEnd: varchar('time_end', { length: 8 }).notNull(),
    motivoCode: varchar('motivo_code', { length: 16 }),
    observaciones: text('observaciones'),
  },
  (t) => [index('idx_he_boleta_lines_header').on(t.headerId)],
);
