import { z } from 'zod';

/** SMTP por módulo (Office 365, etc.). La contraseña se cifra en servidor. */
export const moduleSmtpSettingsBodySchema = z.object({
  smtp_host: z.string().min(1).max(255),
  smtp_port: z.coerce.number().int().min(1).max(65535),
  mail_secure: z.boolean(),
  /** Cuenta SMTP (p. ej. Office 365); obligatoria en producto. */
  smtp_user: z.string().min(1).max(320),
  smtp_from: z.string().min(1).max(320).email(),
  smtp_pass: z.string().max(500).optional(),
});

export type ModuleSmtpSettingsBody = z.infer<typeof moduleSmtpSettingsBodySchema>;

export const moduleSmtpTestBodySchema = z.object({
  to: z.string().min(1).max(320).email(),
});

export type ModuleSmtpTestBody = z.infer<typeof moduleSmtpTestBodySchema>;
