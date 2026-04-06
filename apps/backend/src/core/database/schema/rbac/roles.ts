import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { rbacApps } from './apps';

export const rbacRoles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appId: uuid('app_id')
      .notNull()
      .references(() => rbacApps.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 100 }).notNull(),
    label: varchar('label', { length: 200 }).notNull(),
    level: integer('level').notNull().default(0),
    description: text('description'),
    applicableApps: uuid('applicable_apps').array(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    appIdSlugUniq: uniqueIndex('roles_app_id_slug_key').on(t.appId, t.slug),
    levelCheck: check(
      'roles_level_check',
      sql`(${t.level} >= 0 AND ${t.level} <= 100)`,
    ),
  }),
);
