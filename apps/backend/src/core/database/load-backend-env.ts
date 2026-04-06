import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Carga `.env` del backend aunque el script se ejecute desde la raíz del monorepo
 * (`pnpm --filter @sami/backend …`) o desde `apps/backend`.
 */
export function loadBackendEnv(): void {
  const fromScriptDir = resolve(__dirname, '../../../.env');
  const fromRepoRoot = resolve(process.cwd(), 'apps/backend/.env');
  const fromCwd = resolve(process.cwd(), '.env');

  for (const path of [fromScriptDir, fromRepoRoot, fromCwd]) {
    if (existsSync(path)) {
      loadEnv({ path });
      return;
    }
  }

  loadEnv();
}
