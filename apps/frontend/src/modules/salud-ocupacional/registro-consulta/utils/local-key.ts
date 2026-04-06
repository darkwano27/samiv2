/** Clave estable local sin depender de `crypto.randomUUID` (HTTP / navegadores viejos). */
export function createLocalKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
