import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { workers } from '../workers';
import { rbacModuleProfiles } from './module-profiles';
import { rbacRoles } from './roles';

export const rbacWorkerRoleAssignments = pgTable(
  'worker_role_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workerId: text('worker_id')
      .notNull()
      .references(() => workers.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => rbacRoles.id, { onDelete: 'restrict' }),
    assignedBy: text('assigned_by').references(() => workers.id),
    appliedProfileId: uuid('applied_profile_id').references(
      () => rbacModuleProfiles.id,
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    idxWorker: index('idx_worker_role_assignments_worker').on(t.workerId),
    idxRole: index('idx_worker_role_assignments_role').on(t.roleId),
    uniqManual: uniqueIndex('idx_worker_role_manual_unique')
      .on(t.workerId, t.roleId)
      .where(sql`${t.appliedProfileId} IS NULL`),
  }),
);
