import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  decryptSettingSecret,
  encryptSettingSecret,
  isSettingsEncryptionConfigured,
} from '@core/crypto/settings-encryption';
import { SAMI_DB } from '@core/database/database.module';
import * as schema from '@core/database/schema';
import { moduleSharepointSettings } from '@core/database/schema/module-sharepoint-settings';

export type ModuleSharepointPublicSettings = {
  module_slug: string;
  tenant_id: string | null;
  client_id: string | null;
  client_secret_configured: boolean;
  site_path: string | null;
  drive_name: string | null;
  parent_folder: string | null;
  public_host: string | null;
};

export type ModuleSharepointUpsertBody = {
  tenant_id?: string;
  client_id?: string;
  /** Vacío ⇒ borrar secreto guardado; omitir ⇒ mantener. */
  client_secret?: string;
  site_path?: string;
  drive_name?: string;
  parent_folder?: string;
  public_host?: string;
};

export type ResolvedGraphSharepointConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  sitePath: string;
  driveName: string;
  parentPath: string;
  publicHost: string;
};

function trimOrNull(s: string | null | undefined): string | null {
  const t = (s ?? '').trim();
  return t.length ? t : null;
}

@Injectable()
export class ModuleSharepointService {
  constructor(
    @Inject(SAMI_DB)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly config: ConfigService,
  ) {}

  async getPublicSettings(moduleSlug: string): Promise<ModuleSharepointPublicSettings | null> {
    const [row] = await this.db
      .select()
      .from(moduleSharepointSettings)
      .where(eq(moduleSharepointSettings.moduleSlug, moduleSlug))
      .limit(1);
    if (!row) return null;
    return {
      module_slug: row.moduleSlug,
      tenant_id: trimOrNull(row.tenantId),
      client_id: trimOrNull(row.clientId),
      client_secret_configured: Boolean(row.clientSecretEncrypted?.trim()),
      site_path: trimOrNull(row.sitePath),
      drive_name: trimOrNull(row.driveName),
      parent_folder: trimOrNull(row.parentFolder),
      public_host: trimOrNull(row.publicHost),
    };
  }

  async upsert(
    moduleSlug: string,
    body: ModuleSharepointUpsertBody,
  ): Promise<ModuleSharepointPublicSettings> {
    if (!isSettingsEncryptionConfigured()) {
      throw new ServiceUnavailableException({
        message:
          'El servidor no tiene SETTINGS_ENCRYPTION_KEY; no se pueden guardar secretos de SharePoint.',
      });
    }

    const [existing] = await this.db
      .select()
      .from(moduleSharepointSettings)
      .where(eq(moduleSharepointSettings.moduleSlug, moduleSlug))
      .limit(1);

    let clientSecretEncrypted: string | null;
    if (body.client_secret !== undefined) {
      clientSecretEncrypted =
        body.client_secret === '' ? null : encryptSettingSecret(body.client_secret);
    } else {
      clientSecretEncrypted = existing?.clientSecretEncrypted ?? null;
    }

    const tenantId =
      body.tenant_id !== undefined ? trimOrNull(body.tenant_id) : existing?.tenantId ?? null;
    const clientId =
      body.client_id !== undefined ? trimOrNull(body.client_id) : existing?.clientId ?? null;
    const sitePath =
      body.site_path !== undefined ? trimOrNull(body.site_path) : existing?.sitePath ?? null;
    const driveName =
      body.drive_name !== undefined ? trimOrNull(body.drive_name) : existing?.driveName ?? null;
    const parentFolder =
      body.parent_folder !== undefined ? trimOrNull(body.parent_folder) : existing?.parentFolder ?? null;
    const publicHost =
      body.public_host !== undefined ? trimOrNull(body.public_host) : existing?.publicHost ?? null;

    const now = new Date();
    await this.db
      .insert(moduleSharepointSettings)
      .values({
        moduleSlug,
        tenantId,
        clientId,
        clientSecretEncrypted,
        sitePath,
        driveName,
        parentFolder,
        publicHost,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: moduleSharepointSettings.moduleSlug,
        set: {
          tenantId,
          clientId,
          clientSecretEncrypted,
          sitePath,
          driveName,
          parentFolder,
          publicHost,
          updatedAt: now,
        },
      });

    const out = await this.getPublicSettings(moduleSlug);
    if (!out) {
      throw new ServiceUnavailableException({ message: 'No se pudo leer la configuración.' });
    }
    return out;
  }

  /**
   * Combina fila del módulo (si existe) con variables O365_* del entorno.
   * Requiere tenant, client id y secret resueltos (no vacíos).
   */
  async resolveGraphConfig(moduleSlug: string): Promise<ResolvedGraphSharepointConfig> {
    const [row] = await this.db
      .select()
      .from(moduleSharepointSettings)
      .where(eq(moduleSharepointSettings.moduleSlug, moduleSlug))
      .limit(1);

    const tenantId =
      trimOrNull(row?.tenantId) ?? trimOrNull(this.config.get<string>('O365_TENANT_ID'));
    const clientId =
      trimOrNull(row?.clientId) ?? trimOrNull(this.config.get<string>('O365_CLIENT_ID'));
    let clientSecret = trimOrNull(this.config.get<string>('O365_CLIENT_SECRET'));
    if (row?.clientSecretEncrypted?.trim()) {
      try {
        clientSecret = decryptSettingSecret(row.clientSecretEncrypted);
      } catch {
        clientSecret = null;
      }
    }
    const sitePath =
      trimOrNull(row?.sitePath) ??
      trimOrNull(this.config.get<string>('O365_SP_SITE_PATH')) ??
      'arisindustrial.sharepoint.com:/UA_AF/AF_Sistemas';
    const driveName =
      trimOrNull(row?.driveName) ??
      trimOrNull(this.config.get<string>('O365_SP_DRIVE_NAME')) ??
      'Documentos';
    const parentPath =
      trimOrNull(row?.parentFolder) ??
      trimOrNull(this.config.get<string>('O365_SP_PARENT_FOLDER')) ??
      'Repositorio Apps/Asignacion de Bienes';
    const publicHost =
      trimOrNull(row?.publicHost) ??
      trimOrNull(this.config.get<string>('O365_SP_PUBLIC_HOST')) ??
      'https://arisindustrial.sharepoint.com';

    if (!tenantId || !clientId || !clientSecret) {
      throw new ServiceUnavailableException({
        message:
          'SharePoint / Graph no está configurado: faltan Tenant ID, Client ID o Client Secret (en Ajustes o en variables O365_*).',
      });
    }

    return {
      tenantId,
      clientId,
      clientSecret,
      sitePath,
      driveName,
      parentPath,
      publicHost,
    };
  }

  /** Obtiene token de aplicación; útil para “Probar conexión”. */
  async testGraphToken(moduleSlug: string): Promise<{ ok: true }> {
    const cfg = await this.resolveGraphConfig(moduleSlug);
    const url = `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new BadRequestException({
        message: `No se pudo obtener token Graph (${res.status}). ${t.slice(0, 240)}`,
      });
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) {
      throw new BadRequestException({ message: 'Respuesta Graph sin access_token.' });
    }
    return { ok: true as const };
  }
}
