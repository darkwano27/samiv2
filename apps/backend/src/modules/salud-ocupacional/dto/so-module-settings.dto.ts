import { z } from 'zod';

/** Slug de cualquier perfil del módulo (semilla o creado en UI). */
export const soProfileSlugParamSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const applySoProfileBodySchema = z.object({
  worker_id: z.string().min(1),
  profile_slug: soProfileSlugParamSchema,
});

export type ApplySoProfileBody = z.infer<typeof applySoProfileBodySchema>;

/** Body para `POST .../members/:workerId/profile` (reemplaza todos los roles del módulo). */
export const replaceSoProfileBodySchema = z.object({
  profile_slug: soProfileSlugParamSchema,
});

export type ReplaceSoProfileBody = z.infer<typeof replaceSoProfileBodySchema>;

/** Entrada por app para armar perfil: el backend resuelve el rol que cubre esas acciones. */
export const soAppPermissionEntrySchema = z.object({
  app_slug: z.string().min(1).max(100),
  actions: z.array(z.string().min(1).max(32)),
});

export const createSoModuleProfileBodySchema = z
  .object({
    label: z.string().min(1).max(200),
    description: z.string().max(2000).optional().nullable(),
    slug: z.string().min(1).max(100).optional().nullable(),
    app_permissions: z.array(soAppPermissionEntrySchema),
  })
  .refine((v) => v.app_permissions.some((e) => e.actions.length > 0), {
    message: 'Marcá al menos una acción en alguna aplicación.',
    path: ['app_permissions'],
  });

export type CreateSoModuleProfileBody = z.infer<
  typeof createSoModuleProfileBodySchema
>;

export const updateSoModuleProfileBodySchema = z
  .object({
    label: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    app_permissions: z.array(soAppPermissionEntrySchema).optional(),
  })
  .refine(
    (v) =>
      v.label !== undefined ||
      v.description !== undefined ||
      v.app_permissions !== undefined,
    { message: 'Enviá al menos un campo para actualizar' },
  )
  .refine(
    (v) =>
      v.app_permissions === undefined ||
      v.app_permissions.some((e) => e.actions.length > 0),
    {
      message: 'Marcá al menos una acción en alguna aplicación.',
      path: ['app_permissions'],
    },
  );

export type UpdateSoModuleProfileBody = z.infer<
  typeof updateSoModuleProfileBodySchema
>;

export {
  moduleSmtpSettingsBodySchema,
  moduleSmtpTestBodySchema,
  type ModuleSmtpSettingsBody,
  type ModuleSmtpTestBody,
} from '@core/mail/module-smtp.dto';
