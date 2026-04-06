import {
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { rbacApps } from './apps';

export const rbacAppFeatures = pgTable(
  'app_features',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appId: uuid('app_id')
      .notNull()
      .references(() => rbacApps.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 100 }).notNull(),
    label: varchar('label', { length: 200 }).notNull(),
    description: text('description'),
  },
  (t) => ({
    appIdSlugUniq: uniqueIndex('app_features_app_id_slug_key').on(
      t.appId,
      t.slug,
    ),
  }),
);
