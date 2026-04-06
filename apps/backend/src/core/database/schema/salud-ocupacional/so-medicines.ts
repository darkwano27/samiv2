import {
  boolean,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Catálogo de medicamentos SO (`public.so_medicines`). */
export const soMedicines = pgTable(
  'so_medicines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    presentation: varchar('presentation', { length: 100 }).notNull(),
    concentration: varchar('concentration', { length: 100 }).notNull(),
    administrationRoute: varchar('administration_route', {
      length: 100,
    }).notNull(),
    inventoryUnit: varchar('inventory_unit', { length: 100 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    idxName: index('idx_so_medicines_name').on(t.name),
  }),
);
