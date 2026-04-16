import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { soConsultations } from './so-consultations';
import { soMedicines } from './so-medicines';

/**
 * Prescripción con snapshot inmutable del medicamento (`public.so_prescriptions`).
 */
export const soPrescriptions = pgTable(
  'so_prescriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    consultationId: uuid('consultation_id')
      .notNull()
      .references(() => soConsultations.id, { onDelete: 'cascade' }),
    medicineId: uuid('medicine_id')
      .notNull()
      .references(() => soMedicines.id, { onDelete: 'restrict' }),
    medicineName: varchar('medicine_name', { length: 200 }).notNull(),
    presentation: varchar('presentation', { length: 100 }).notNull(),
    concentration: varchar('concentration', { length: 100 }).notNull(),
    administrationRoute: varchar('administration_route', {
      length: 100,
    }).notNull(),
    frequency: varchar('frequency', { length: 100 }),
    duration: varchar('duration', { length: 100 }),
    quantity: integer('quantity').notNull(),
    instructions: text('instructions'),
  },
  (t) => ({
    chkQty: check('so_prescriptions_quantity_check', sql`${t.quantity} >= 0`),
    idxConsultation: index('idx_so_prescriptions_consultation_id').on(
      t.consultationId,
    ),
    idxMedicine: index('idx_so_prescriptions_medicine_id').on(t.medicineId),
  }),
);
