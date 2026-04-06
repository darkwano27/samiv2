import { sql } from 'drizzle-orm';
import { pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { rbacAppFeatures } from './app-features';
import { rbacRoles } from './roles';

export const rbacRolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => rbacRoles.id, { onDelete: 'cascade' }),
    featureId: uuid('feature_id')
      .notNull()
      .references(() => rbacAppFeatures.id, { onDelete: 'cascade' }),
    /** Acciones otorgadas (p. ej. read, create, update, delete). Default en BD: read. */
    actions: text('actions')
      .array()
      .notNull()
      .default(sql`ARRAY['read']::text[]`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.featureId] }),
  }),
);
