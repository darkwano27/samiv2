import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { rbacModuleProfiles } from './module-profiles';
import { rbacRoles } from './roles';

export const rbacDefaultRoleAssignments = pgTable(
  'default_role_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    moduleProfileId: uuid('module_profile_id')
      .notNull()
      .references(() => rbacModuleProfiles.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => rbacRoles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    idxProfile: index('idx_default_role_assignments_profile').on(
      t.moduleProfileId,
    ),
  }),
);
