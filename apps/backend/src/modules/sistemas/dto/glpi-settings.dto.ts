import { z } from 'zod';

export const moduleGlpiSettingsBodySchema = z.object({
  glpi_db_host: z.string().min(1).max(255),
  glpi_db_port: z.coerce.number().int().min(1).max(65535).default(3306),
  glpi_db_user: z.string().min(1).max(160),
  glpi_db_name: z.string().min(1).max(128),
  glpi_db_pass: z.string().optional(),
});

export type ModuleGlpiSettingsBody = z.infer<typeof moduleGlpiSettingsBodySchema>;

const moduleGlpiTestBodyInner = z
  .object({
    glpi_db_host: z.string().min(1).max(255).optional(),
    glpi_db_port: z.coerce.number().int().min(1).max(65535).optional(),
    glpi_db_user: z.string().min(1).max(160).optional(),
    glpi_db_name: z.string().min(1).max(128).optional(),
    glpi_db_pass: z.string().optional(),
  })
  .refine(
    (d) => {
      const any =
        d.glpi_db_host != null ||
        d.glpi_db_user != null ||
        d.glpi_db_name != null ||
        d.glpi_db_port != null ||
        d.glpi_db_pass != null;
      if (!any) return true;
      return Boolean(
        d.glpi_db_host?.trim() && d.glpi_db_user?.trim() && d.glpi_db_name?.trim(),
      );
    },
    {
      message:
        'Si enviás datos de conexión en el cuerpo, host, usuario y base son obligatorios.',
    },
  );

/** Cuerpo vacío o ausente ⇒ probar con la configuración guardada. */
export const moduleGlpiTestBodySchema = z.preprocess(
  (raw) => (raw == null || typeof raw !== 'object' ? {} : raw),
  moduleGlpiTestBodyInner,
);

export type ModuleGlpiTestBody = z.infer<typeof moduleGlpiTestBodyInner>;
