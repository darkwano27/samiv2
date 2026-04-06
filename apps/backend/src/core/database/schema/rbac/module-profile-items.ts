import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { rbacAppFeatures } from './app-features';
import { rbacApps } from './apps';
import { rbacModuleProfiles } from './module-profiles';
import { rbacRoles } from './roles';

export const rbacModuleProfileItems = pgTable(
  'module_profile_items',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => rbacModuleProfiles.id, { onDelete: 'cascade' }),
    appId: uuid('app_id')
      .notNull()
      .references(() => rbacApps.id, { onDelete: 'cascade' }),
    featureId: uuid('feature_id')
      .notNull()
      .references(() => rbacAppFeatures.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => rbacRoles.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.profileId, t.appId, t.featureId, t.roleId],
    }),
  }),
);
