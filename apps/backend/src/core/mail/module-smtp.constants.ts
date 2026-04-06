/**
 * Host SMTP reservado: indica que el envío usa `SMTP_*` del `.env` (sin credenciales en tabla).
 * Ver `module_smtp_settings` con `module_slug = 'system'` (correo de auth, etc.).
 */
export const MODULE_SMTP_USE_ENV_MARKER = '__USE_ENV__';
