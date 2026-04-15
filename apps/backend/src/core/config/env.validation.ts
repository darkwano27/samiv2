import { z } from 'zod';

function boolEnv(defaultValue: boolean) {
  return z.preprocess((val: unknown) => {
    if (val === undefined || val === '') return defaultValue;
    if (typeof val === 'boolean') return val;
    const s = String(val).toLowerCase();
    if (['true', '1', 'yes'].includes(s)) return true;
    if (['false', '0', 'no'].includes(s)) return false;
    return defaultValue;
  }, z.boolean());
}

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SAP_DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL: z.coerce.number().default(86_400_000),
  LDAP_URL: z.string().url(),
  LDAP_BASE_DN: z.string().min(1),
  LDAP_BIND_DN: z.string().min(1),
  LDAP_BIND_PASSWORD: z.string().min(1),
  /** Base de búsqueda del usuario AD (default: LDAP_BASE_DN) */
  LDAP_SEARCH_BASE: z.string().optional(),
  /** Atributo AD donde está el código SAP / pernr (default: postalCode) */
  LDAP_POSTALCODE_ATTR: z.string().optional(),
  /**
   * Filtro LDAP con placeholder {sapCode} (default: user + postalCode).
   * Ejemplo: (&(objectClass=user)(objectCategory=person)(postalCode={sapCode}))
   */
  LDAP_AUTH_FILTER: z.string().optional(),
  /**
   * Si es false: no se usa AD/LDAP en login ni identify; solo local / new-local.
   * Útil cuando SAP trae `correo_corp` poblado pero no hay directorio real (p. ej. dev).
   */
  LDAP_AD_AUTH_ENABLED: boolEnv(true),
  /**
   * Cómo localizar la cuenta AD al hacer login corporativo:
   * - `corporate_mail`: buscar por mail/UPN = `correo_corp` en SAP (varios pernr pueden compartir cuenta).
   * - `sap_code`: solo `postalCode` (o LDAP_AUTH_FILTER) = pernr (1:1).
   * - `corporate_mail_then_sap_code`: primero por correo; si no hay usuario, intenta por pernr.
   */
  LDAP_AD_AUTH_STRATEGY: z
    .enum(['corporate_mail', 'sap_code', 'corporate_mail_then_sap_code'])
    .default('corporate_mail_then_sap_code'),
  EMAIL_ENABLED: boolEnv(false),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /** Remitente por defecto si `module_smtp_settings.system` usa fallback `.env` */
  SMTP_FROM: z.string().optional(),
  /** Cifrado de `smtp_pass_encrypted` en `module_smtp_settings` */
  SETTINGS_ENCRYPTION_KEY: z.string().optional(),
  THROTTLER_TTL: z.coerce.number().default(60_000),
  THROTTLER_LIMIT: z.coerce.number().default(100),
  /** Microsoft Graph — SharePoint (Asignación de bienes); opcionales hasta usar subida */
  O365_TENANT_ID: z.string().optional(),
  O365_CLIENT_ID: z.string().optional(),
  O365_CLIENT_SECRET: z.string().optional(),
  /** Ej. `arisindustrial.sharepoint.com:/UA_AF/AF_Sistemas` */
  O365_SP_SITE_PATH: z.string().optional(),
  O365_SP_DRIVE_NAME: z.string().optional(),
  O365_SP_PARENT_FOLDER: z.string().optional(),
  O365_SP_PUBLIC_HOST: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Environment validation failed:\n${result.error.toString()}`);
  }
  return result.data;
}
