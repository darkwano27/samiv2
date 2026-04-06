import { z } from 'zod';

export const identifySchema = z.object({
  sap_code: z.string().regex(/^\d+$/).min(1),
});

export const loginSchema = z.object({
  sap_code: z.string().regex(/^\d+$/).min(1),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  sap_code: z.string().regex(/^\d+$/).min(1),
  dni: z.string().regex(/^\d{8}$/),
});

export const recoverSchema = registerSchema;

export const changePasswordSchema = z
  .object({
    temp_token: z.string().uuid(),
    new_password: z
      .string()
      .min(8)
      .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
      .regex(/[0-9]/, 'Debe incluir al menos un número'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm_password'],
  });

export type IdentifyBody = z.infer<typeof identifySchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type RegisterBody = z.infer<typeof registerSchema>;
export type RecoverBody = z.infer<typeof recoverSchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
