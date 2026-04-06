/**
 * Controla logs de eventos de sesión / auth relacionados.
 * - `LOG_SESSION_EVENTS=false` → nunca
 * - `LOG_SESSION_EVENTS=true` → siempre
 * - sin definir → solo si NODE_ENV !== production
 */
export function isSessionEventLoggingEnabled(
  nodeEnv: string | undefined,
): boolean {
  const raw = process.env.LOG_SESSION_EVENTS?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no') {
    return false;
  }
  if (raw === 'true' || raw === '1' || raw === 'yes') {
    return true;
  }
  return nodeEnv !== 'production';
}
