import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createConnection } from 'mysql2/promise';
import {
  decryptSettingSecret,
  encryptSettingSecret,
  isSettingsEncryptionConfigured,
} from '@core/crypto/settings-encryption';
import { SAMI_DB } from '@core/database/database.module';
import * as schema from '@core/database/schema';
import { moduleGlpiSettings } from '@core/database/schema/module-glpi-settings';

export type ModuleGlpiPublicSettings = {
  module_slug: string;
  glpi_db_host: string;
  glpi_db_port: number;
  glpi_db_user: string;
  glpi_db_name: string;
  glpi_db_pass_configured: boolean;
};

export type ModuleGlpiUpsertBody = {
  glpi_db_host: string;
  glpi_db_port: number;
  glpi_db_user: string;
  glpi_db_name: string;
  /** Vacío ⇒ borrar contraseña guardada; omitir ⇒ mantener la actual. */
  glpi_db_pass?: string;
};

export type ModuleGlpiTestInline = {
  glpi_db_host?: string;
  glpi_db_port?: number;
  glpi_db_user?: string;
  glpi_db_name?: string;
  glpi_db_pass?: string;
};

@Injectable()
export class ModuleGlpiService {
  constructor(
    @Inject(SAMI_DB)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getPublicSettings(moduleSlug: string): Promise<ModuleGlpiPublicSettings | null> {
    const [row] = await this.db
      .select()
      .from(moduleGlpiSettings)
      .where(eq(moduleGlpiSettings.moduleSlug, moduleSlug))
      .limit(1);
    if (!row) return null;
    return {
      module_slug: row.moduleSlug,
      glpi_db_host: row.dbHost,
      glpi_db_port: row.dbPort,
      glpi_db_user: row.dbUser,
      glpi_db_name: row.dbName,
      glpi_db_pass_configured: Boolean(row.dbPassEncrypted?.trim()),
    };
  }

  async upsert(moduleSlug: string, body: ModuleGlpiUpsertBody): Promise<ModuleGlpiPublicSettings> {
    if (!isSettingsEncryptionConfigured()) {
      throw new ServiceUnavailableException({
        message:
          'El servidor no tiene SETTINGS_ENCRYPTION_KEY; no se pueden guardar credenciales GLPI.',
      });
    }

    const [existing] = await this.db
      .select()
      .from(moduleGlpiSettings)
      .where(eq(moduleGlpiSettings.moduleSlug, moduleSlug))
      .limit(1);

    let dbPassEncrypted: string | null;
    if (body.glpi_db_pass !== undefined) {
      dbPassEncrypted =
        body.glpi_db_pass === '' ? null : encryptSettingSecret(body.glpi_db_pass);
    } else {
      dbPassEncrypted = existing?.dbPassEncrypted ?? null;
    }

    const port = body.glpi_db_port;
    const now = new Date();
    await this.db
      .insert(moduleGlpiSettings)
      .values({
        moduleSlug,
        dbHost: body.glpi_db_host.trim(),
        dbPort: port,
        dbUser: body.glpi_db_user.trim(),
        dbName: body.glpi_db_name.trim(),
        dbPassEncrypted,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: moduleGlpiSettings.moduleSlug,
        set: {
          dbHost: body.glpi_db_host.trim(),
          dbPort: port,
          dbUser: body.glpi_db_user.trim(),
          dbName: body.glpi_db_name.trim(),
          dbPassEncrypted,
          updatedAt: now,
        },
      });

    const out = await this.getPublicSettings(moduleSlug);
    if (!out) {
      throw new ServiceUnavailableException({ message: 'No se pudo leer la configuración GLPI' });
    }
    return out;
  }

  /**
   * Credenciales listas para consultas de solo lectura (p. ej. Asignación de bienes).
   * `null` si no hay fila o falta cifrado.
   */
  async getResolvedReadonlyCredentials(
    moduleSlug: string,
  ): Promise<{
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  } | null> {
    if (!isSettingsEncryptionConfigured()) return null;
    const [row] = await this.db
      .select()
      .from(moduleGlpiSettings)
      .where(eq(moduleGlpiSettings.moduleSlug, moduleSlug))
      .limit(1);
    if (!row) return null;
    const password = row.dbPassEncrypted?.trim()
      ? decryptSettingSecret(row.dbPassEncrypted)
      : '';
    return {
      host: row.dbHost,
      port: row.dbPort,
      user: row.dbUser,
      password,
      database: row.dbName,
    };
  }

  /**
   * Prueba conexión MySQL. Si el cuerpo trae host+usuario+base, usa eso (valores del formulario);
   * si no, usa la configuración guardada.
   */
  async testConnection(moduleSlug: string, inline?: ModuleGlpiTestInline): Promise<{ ok: true }> {
    const hasInline =
      Boolean(inline?.glpi_db_host?.trim()) ||
      Boolean(inline?.glpi_db_user?.trim()) ||
      Boolean(inline?.glpi_db_name?.trim());

    let host: string;
    let port: number;
    let user: string;
    let database: string;
    let password: string;

    if (hasInline) {
      if (
        !inline?.glpi_db_host?.trim() ||
        !inline?.glpi_db_user?.trim() ||
        !inline?.glpi_db_name?.trim()
      ) {
        throw new BadRequestException({
          message:
            'Para probar sin guardar, completá host, usuario y nombre de base de datos.',
        });
      }
      host = inline.glpi_db_host.trim();
      port = inline.glpi_db_port ?? 3306;
      user = inline.glpi_db_user.trim();
      database = inline.glpi_db_name.trim();
      password = inline.glpi_db_pass ?? '';
    } else {
      const creds = await this.getResolvedReadonlyCredentials(moduleSlug);
      if (!creds) {
        throw new BadRequestException({
          message: 'No hay configuración GLPI guardada. Guardá primero o enviá los datos en el cuerpo.',
        });
      }
      ({ host, port, user, password, database: database } = creds);
    }

    let conn: Awaited<ReturnType<typeof createConnection>> | undefined;
    try {
      conn = await createConnection({
        host,
        port,
        user,
        password,
        database,
        connectTimeout: 12_000,
      });
      await conn.query('SELECT 1 AS ok');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException({
        message: `No se pudo conectar a MySQL (GLPI): ${msg}`,
      });
    } finally {
      await conn?.end().catch(() => {});
    }
    return { ok: true as const };
  }
}
