import { z } from 'zod';

export const moduleSharepointSettingsBodySchema = z.object({
  tenant_id: z.string().max(128).optional(),
  client_id: z.string().max(128).optional(),
  client_secret: z.string().max(500).optional(),
  site_path: z.string().max(512).optional(),
  drive_name: z.string().max(128).optional(),
  parent_folder: z.string().max(512).optional(),
  public_host: z.string().max(512).optional(),
});

export type ModuleSharepointSettingsBody = z.infer<typeof moduleSharepointSettingsBodySchema>;
