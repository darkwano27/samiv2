import { jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { workers } from '../workers';

/** Acciones por app guardadas al crear/editar perfil custom (modal). */
export type ModuleProfileAppPermissionsJson = {
  app_slug: string;
  actions: string[];
}[];

export const rbacModuleProfiles = pgTable('module_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleSlug: varchar('module_slug', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  label: varchar('label', { length: 200 }).notNull(),
  description: text('description'),
  /** Solo perfiles no semilla: lo que el usuario marcó en el modal (el rol puede ser más amplio). */
  appPermissionsJson: jsonb('app_permissions_json').$type<ModuleProfileAppPermissionsJson | null>(),
  createdBy: text('created_by').references(() => workers.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
