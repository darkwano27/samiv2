import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as sapSchema from './schema-sap';

export const SAMI_DB = 'SAMI_DB';
export const SAP_DB = 'SAP_DB';

@Global()
@Module({
  providers: [
    {
      provide: SAMI_DB,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const url = config.getOrThrow<string>('DATABASE_URL');
        const client = postgres(url, { max: 10 });
        try {
          await client`SELECT 1`;
        } catch (e) {
          await client.end({ timeout: 2 }).catch(() => {});
          throw e;
        }
        return drizzle(client, { schema });
      },
    },
    {
      provide: SAP_DB,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        let client: ReturnType<typeof postgres> | undefined;
        try {
          const url = config.getOrThrow<string>('SAP_DATABASE_URL');
          client = postgres(url, { max: 5 });
          await client`SELECT 1`;
          return drizzle(client, { schema: sapSchema });
        } catch (err) {
          if (client) await client.end({ timeout: 2 }).catch(() => {});
          console.warn(
            '[DatabaseModule] SAP_DB connection failed — continuing without it:',
            err instanceof Error ? err.message : err,
          );
          return null;
        }
      },
    },
  ],
  exports: [SAMI_DB, SAP_DB],
})
export class DatabaseModule {}
