import { z } from 'zod';

export const workforceBoletaExportPatchSchema = z.object({
  protocol: z.enum(['sftp', 'smb']),
  host: z.string().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  remote_path: z.string().min(1).max(2000),
  share_name: z.string().max(512).nullable().optional(),
  username: z.string().max(320).nullable().optional(),
  /** Vacío = mantener; ausente en JSON = mantener (usar PATCH explícito). */
  password: z.string().max(500).optional(),
});

export type WorkforceBoletaExportPatchBody = z.infer<typeof workforceBoletaExportPatchSchema>;
