import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createConnection } from 'node:net';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  decryptSettingSecret,
  encryptSettingSecret,
  isSettingsEncryptionConfigured,
} from '@core/crypto/settings-encryption';
import { SAMI_DB } from '@core/database/database.module';
import * as schema from '@core/database/schema';
import { workforceBoletaExportSettings } from '@core/database/schema/workforce-boleta-export-settings';
import type { WorkforceBoletaExportPatchBody } from './dto/workforce-boleta-export.dto';
import { MODULE_SLUG_HORAS_EXTRA } from './workforce-aris.constants';

export type WorkforceBoletaExportPublic = {
  module_slug: string;
  protocol: 'sftp' | 'smb';
  host: string;
  port: number;
  remote_path: string;
  share_name: string | null;
  username: string | null;
  password_configured: boolean;
};

@Injectable()
export class WorkforceBoletaExportService {
  constructor(@Inject(SAMI_DB) private readonly db: PostgresJsDatabase<typeof schema>) {}

  private rowToPublic(r: typeof workforceBoletaExportSettings.$inferSelect): WorkforceBoletaExportPublic {
    const p = (r.protocol ?? 'sftp').trim().toLowerCase();
    return {
      module_slug: r.moduleSlug,
      protocol: p === 'smb' ? 'smb' : 'sftp',
      host: r.host ?? '',
      port: r.port ?? 22,
      remote_path: r.remotePath ?? '/',
      share_name: r.shareName?.trim() || null,
      username: r.username?.trim() || null,
      password_configured: Boolean(r.passwordEncrypted?.trim()),
    };
  }

  async getPublic(): Promise<WorkforceBoletaExportPublic | null> {
    const [row] = await this.db
      .select()
      .from(workforceBoletaExportSettings)
      .where(eq(workforceBoletaExportSettings.moduleSlug, MODULE_SLUG_HORAS_EXTRA))
      .limit(1);
    if (!row) return null;
    return this.rowToPublic(row);
  }

  async upsert(body: WorkforceBoletaExportPatchBody): Promise<WorkforceBoletaExportPublic> {
    if (!isSettingsEncryptionConfigured()) {
      throw new ServiceUnavailableException({
        message:
          'El servidor no tiene SETTINGS_ENCRYPTION_KEY; no se pueden guardar credenciales de acceso.',
      });
    }

    const [existing] = await this.db
      .select()
      .from(workforceBoletaExportSettings)
      .where(eq(workforceBoletaExportSettings.moduleSlug, MODULE_SLUG_HORAS_EXTRA))
      .limit(1);

    let passwordEncrypted: string | null;
    if (body.password !== undefined) {
      passwordEncrypted =
        body.password === '' ? null : encryptSettingSecret(body.password);
    } else {
      passwordEncrypted = existing?.passwordEncrypted ?? null;
    }

    const now = new Date();
    const share =
      body.share_name === undefined
        ? (existing?.shareName ?? null)
        : body.share_name === null || body.share_name === ''
          ? null
          : body.share_name.trim();

    const user =
      body.username === undefined
        ? (existing?.username ?? null)
        : body.username === null || body.username === ''
          ? null
          : body.username.trim();

    await this.db
      .insert(workforceBoletaExportSettings)
      .values({
        moduleSlug: MODULE_SLUG_HORAS_EXTRA,
        protocol: body.protocol,
        host: body.host.trim(),
        port: body.port,
        remotePath: body.remote_path.trim(),
        shareName: share,
        username: user,
        passwordEncrypted,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: workforceBoletaExportSettings.moduleSlug,
        set: {
          protocol: body.protocol,
          host: body.host.trim(),
          port: body.port,
          remotePath: body.remote_path.trim(),
          shareName: share,
          username: user,
          passwordEncrypted,
          updatedAt: now,
        },
      });

    const out = await this.getPublic();
    if (!out) {
      throw new ServiceUnavailableException({ message: 'No se pudo leer la configuración.' });
    }
    return out;
  }

  /**
   * Prueba conectividad TCP al host:puerto (no valida SFTP/SMB completo).
   */
  async testReachability(): Promise<{ ok: true; ms: number } | { ok: false; message: string }> {
    const [row] = await this.db
      .select()
      .from(workforceBoletaExportSettings)
      .where(eq(workforceBoletaExportSettings.moduleSlug, MODULE_SLUG_HORAS_EXTRA))
      .limit(1);
    const host = row?.host?.trim();
    const port = row?.port ?? 22;
    if (!host) {
      return { ok: false, message: 'Configurá primero el host o la dirección del servidor.' };
    }
    const started = Date.now();
    return new Promise((resolve) => {
      const socket = createConnection({ host, port }, () => {
        socket.end();
        resolve({ ok: true as const, ms: Date.now() - started });
      });
      socket.setTimeout(8000);
      socket.on('error', (err: Error) => {
        resolve({
          ok: false,
          message: err.message || 'No se pudo conectar (firewall, host o puerto).',
        });
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ ok: false, message: 'Tiempo de espera agotado al conectar.' });
      });
    });
  }

  /** Para el job que suba CSV (futuro): descifrar contraseña si existe. */
  async getDecryptedPasswordForJob(): Promise<string | null> {
    const [row] = await this.db
      .select()
      .from(workforceBoletaExportSettings)
      .where(eq(workforceBoletaExportSettings.moduleSlug, MODULE_SLUG_HORAS_EXTRA))
      .limit(1);
    const enc = row?.passwordEncrypted?.trim();
    if (!enc) return null;
    if (!isSettingsEncryptionConfigured()) return null;
    try {
      return decryptSettingSecret(enc);
    } catch {
      return null;
    }
  }
}
