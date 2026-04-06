import {
  index,
  pgTable,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { soConsultations } from './so-consultations';
import { soDiagnoses } from './so-diagnoses';

/** N:N consulta ↔ diagnóstico (`public.so_consultation_diagnoses`). */
export const soConsultationDiagnoses = pgTable(
  'so_consultation_diagnoses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    consultationId: uuid('consultation_id')
      .notNull()
      .references(() => soConsultations.id, { onDelete: 'cascade' }),
    diagnosisId: uuid('diagnosis_id')
      .notNull()
      .references(() => soDiagnoses.id, { onDelete: 'restrict' }),
  },
  (t) => ({
    uniqPair: unique('uq_so_consultation_diagnosis_pair').on(
      t.consultationId,
      t.diagnosisId,
    ),
    idxConsultation: index('idx_so_consultation_diagnoses_consultation').on(
      t.consultationId,
    ),
  }),
);
