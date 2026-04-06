import { z } from 'zod';

const base64Field = z
  .string()
  .max(2_500_000)
  .nullable()
  .optional();

export const patchUserSignatureSchema = z.object({
  drawn_base64: base64Field,
  uploaded_base64: base64Field,
  uploaded_mime: z.enum(['image/png', 'image/jpeg', 'image/webp']).nullable().optional(),
  preferred: z.enum(['drawn', 'uploaded']).nullable().optional(),
});

export type PatchUserSignatureBody = z.infer<typeof patchUserSignatureSchema>;
