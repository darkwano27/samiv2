import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { loadBackendEnv } from './load-backend-env';
import * as schema from './schema';
import { runSoCatalogSeed } from './seeds/so-catalog.seed';

loadBackendEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL no definido');
  }
  const client = postgres(url, { max: 1 });
  try {
    const db = drizzle(client, { schema });
    const r = await runSoCatalogSeed(db);
    console.log('[seed:so-catalog]', r);
  } finally {
    await client.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
