import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { workers } from '../workers';

/**
 * Consulta médica ocupacional (`public.so_consultations`).
 * `patient_cod` = pernr SAP (referencia lógica; maestro en SAP staging).
 */
export const soConsultations = pgTable(
  'so_consultations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientCod: varchar('patient_cod', { length: 20 }).notNull(),
    patientName: varchar('patient_name', { length: 200 }).notNull(),
    patientPosition: varchar('patient_position', { length: 200 }),
    patientDivision: varchar('patient_division', { length: 200 }),
    patientSubdivision: varchar('patient_subdivision', { length: 200 }),
    /** Sede / establecimiento (réplica SAP `sede`), snapshot al guardar. */
    patientEstabl: varchar('patient_establ', { length: 200 }),
    /** DNI / documento (`perid` SAP). */
    patientDocumentId: varchar('patient_document_id', { length: 32 }),
    /** Fecha nacimiento ISO (`gbdat` SAP). */
    patientBirthDate: varchar('patient_birth_date', { length: 32 }),
    /** Centro de costo (cuando exista en réplica). */
    patientCostCenter: varchar('patient_cost_center', { length: 64 }),
    /** Fecha ingreso empresa (cuando exista en réplica). */
    patientHireDate: varchar('patient_hire_date', { length: 32 }),
    patientAge: integer('patient_age'),
    patientEmail: varchar('patient_email', { length: 200 }),
    referredByCod: varchar('referred_by_cod', { length: 20 }),
    referredByName: varchar('referred_by_name', { length: 200 }),
    attentionDate: timestamp('attention_date', { withTimezone: true })
      .notNull(),
    reason: text('reason'),
    dischargeCondition: varchar('discharge_condition', { length: 20 })
      .notNull(),
    receiptNumber: varchar('receipt_number', { length: 50 }),
    emailTo: varchar('email_to', { length: 200 }),
    emailCc: jsonb('email_cc').$type<string[]>(),
    signatureData: text('signature_data'),
    /** Número de atención visible (correlativo), distinto del UUID `id`. */
    correlative: integer('correlative')
      .notNull()
      .default(sql`nextval('so_consultations_correlative_seq')`),
    createdBy: text('created_by')
      .notNull()
      .references(() => workers.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    chkAge: check(
      'so_consultations_patient_age_check',
      sql`${t.patientAge} IS NULL OR (${t.patientAge} >= 0 AND ${t.patientAge} <= 120)`,
    ),
    chkDischarge: check(
      'so_consultations_discharge_check',
      sql`${t.dischargeCondition} IN ('observacion','recuperado','derivado')`,
    ),
    idxPatientCod: index('idx_so_consultations_patient_cod').on(t.patientCod),
    idxCreatedBy: index('idx_so_consultations_created_by').on(t.createdBy),
    idxAttentionDate: index('idx_so_consultations_attention_date').on(
      t.attentionDate,
    ),
  }),
);
