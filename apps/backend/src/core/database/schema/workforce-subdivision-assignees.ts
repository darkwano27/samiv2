import { pgTable, primaryKey, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { workers } from './workers';

/** Supervisores y aprobadores por subdivisión (WorkForce / horas extra). */
export const workforceSubdivisionRoleAssignees = pgTable(
  'workforce_subdivision_role_assignees',
  {
    divisionCode: varchar('division_code', { length: 24 }).notNull(),
    subdivisionCode: varchar('subdivision_code', { length: 24 }).notNull(),
    role: varchar('role', { length: 24 }).notNull(),
    workerId: text('worker_id')
      .notNull()
      .references(() => workers.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.divisionCode, t.subdivisionCode, t.role, t.workerId],
    }),
  ],
);
