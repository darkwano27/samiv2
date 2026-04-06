import { sql } from 'drizzle-orm';
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Catálogo de apps por módulo (RBAC). Tabla física: `apps`. */
export const rbacApps = pgTable(
  'apps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 100 }).unique().notNull(),
    moduleSlug: varchar('module_slug', { length: 100 }).notNull(),
    label: varchar('label', { length: 200 }).notNull(),
    description: text('description'),
    isManagement: boolean('is_management').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    oneMgmtPerModule: uniqueIndex('idx_apps_one_mgmt_per_module')
      .on(t.moduleSlug)
      .where(sql`${t.isManagement} = true`),
  }),
);
