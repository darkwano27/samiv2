import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as nodemailer from 'nodemailer';
import {
  decryptSettingSecret,
  encryptSettingSecret,
  isSettingsEncryptionConfigured,
} from '@core/crypto/settings-encryption';
import { SAMI_DB } from '@core/database/database.module';
import * as schema from '@core/database/schema';
import { moduleSmtpSettings } from '@core/database/schema/module-smtp-settings';
import { MODULE_SMTP_USE_ENV_MARKER } from './module-smtp.constants';

export type ModuleSmtpPublicSettings = {
  module_slug: string;
  smtp_host: string;
  smtp_port: number;
  mail_secure: boolean;
  smtp_user: string | null;
  smtp_from: string;
  smtp_pass_configured: boolean;
};

export type ModuleSmtpUpsertBody = {
  smtp_host: string;
  smtp_port: number;
  mail_secure: boolean;
  smtp_user: string;
  smtp_from: string;
  smtp_pass?: string;
};

@Injectable()
export class ModuleSmtpService {
  constructor(
    @Inject(SAMI_DB)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly config: ConfigService,
  ) {}

  async getPublicSettings(moduleSlug: string): Promise<ModuleSmtpPublicSettings | null> {
    const [row] = await this.db
      .select()
      .from(moduleSmtpSettings)
      .where(eq(moduleSmtpSettings.moduleSlug, moduleSlug))
      .limit(1);
    if (!row) return null;
    return {
      module_slug: row.moduleSlug,
      smtp_host: row.smtpHost,
      smtp_port: row.smtpPort,
      mail_secure: row.mailSecure,
      smtp_user: row.smtpUser ?? null,
      smtp_from: row.smtpFrom,
      smtp_pass_configured: Boolean(row.smtpPassEncrypted?.trim()),
    };
  }

  async upsert(moduleSlug: string, body: ModuleSmtpUpsertBody): Promise<ModuleSmtpPublicSettings> {
    if (!isSettingsEncryptionConfigured()) {
      throw new ServiceUnavailableException({
        message:
          'El servidor no tiene SETTINGS_ENCRYPTION_KEY; no se pueden guardar credenciales SMTP.',
      });
    }

    const [existing] = await this.db
      .select()
      .from(moduleSmtpSettings)
      .where(eq(moduleSmtpSettings.moduleSlug, moduleSlug))
      .limit(1);

    let smtpPassEncrypted: string | null;
    if (body.smtp_pass !== undefined) {
      smtpPassEncrypted =
        body.smtp_pass === '' ? null : encryptSettingSecret(body.smtp_pass);
    } else {
      smtpPassEncrypted = existing?.smtpPassEncrypted ?? null;
    }

    const smtpUserResolved = body.smtp_user.trim();

    const now = new Date();
    await this.db
      .insert(moduleSmtpSettings)
      .values({
        moduleSlug,
        smtpHost: body.smtp_host,
        smtpPort: body.smtp_port,
        mailSecure: body.mail_secure,
        smtpUser: smtpUserResolved,
        smtpFrom: body.smtp_from.trim(),
        smtpPassEncrypted,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: moduleSmtpSettings.moduleSlug,
        set: {
          smtpHost: body.smtp_host,
          smtpPort: body.smtp_port,
          mailSecure: body.mail_secure,
          smtpUser: smtpUserResolved,
          smtpFrom: body.smtp_from.trim(),
          smtpPassEncrypted,
          updatedAt: now,
        },
      });

    const out = await this.getPublicSettings(moduleSlug);
    if (!out) {
      throw new ServiceUnavailableException({ message: 'No se pudo leer la configuración SMTP' });
    }
    return out;
  }

  /**
   * Envío real: tabla con host real, o `MODULE_SMTP_USE_ENV_MARKER` → `.env`.
   */
  async sendTestEmail(moduleSlug: string, to: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(moduleSmtpSettings)
      .where(eq(moduleSmtpSettings.moduleSlug, moduleSlug))
      .limit(1);
    if (!row) {
      await this.sendTestViaEnv(to);
      return;
    }
    if (row.smtpHost === MODULE_SMTP_USE_ENV_MARKER) {
      await this.sendTestViaEnv(to);
      return;
    }
    if (!isSettingsEncryptionConfigured()) {
      throw new ServiceUnavailableException({
        message: 'El servidor no tiene SETTINGS_ENCRYPTION_KEY.',
      });
    }
    let pass: string | undefined;
    if (row.smtpPassEncrypted?.trim()) {
      pass = decryptSettingSecret(row.smtpPassEncrypted);
    }
    if (row.smtpUser?.trim() && !pass) {
      throw new ServiceUnavailableException({
        message: 'Hay usuario SMTP pero falta contraseña guardada.',
      });
    }
    const transporter = nodemailer.createTransport({
      host: row.smtpHost,
      port: row.smtpPort,
      secure: row.mailSecure || row.smtpPort === 465,
      auth:
        row.smtpUser?.trim() && pass
          ? { user: row.smtpUser.trim(), pass }
          : undefined,
    });
    await transporter.sendMail({
      from: row.smtpFrom,
      to: to.trim(),
      subject: 'SAMI — Prueba de correo (módulo)',
      text:
        'Si recibís este mensaje, el envío SMTP configurado para el módulo es correcto.',
    });
  }

  private async sendTestViaEnv(to: string): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM') ?? user;
    if (!host || !port || !from) {
      throw new NotFoundException({
        message:
          'No hay SMTP en tabla ni variables SMTP_HOST/SMTP_PORT/SMTP_FROM (y opcional SMTP_USER/SMTP_PASS) en el servidor.',
      });
    }
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    await transporter.sendMail({
      from,
      to: to.trim(),
      subject: 'SAMI — Prueba de correo (vía .env)',
      text: 'Si recibís este mensaje, el SMTP definido en variables de entorno funciona.',
    });
  }

  /**
   * `null` → usar `SMTP_*` del `.env` (mismo criterio que auth legacy).
   */
  async createTransporterForModule(
    moduleSlug: string,
  ): Promise<nodemailer.Transporter | null> {
    const [row] = await this.db
      .select()
      .from(moduleSmtpSettings)
      .where(eq(moduleSmtpSettings.moduleSlug, moduleSlug))
      .limit(1);
    if (!row || row.smtpHost === MODULE_SMTP_USE_ENV_MARKER) return null;
    if (!isSettingsEncryptionConfigured()) return null;
    const pass = row.smtpPassEncrypted?.trim()
      ? decryptSettingSecret(row.smtpPassEncrypted)
      : undefined;
    if (row.smtpUser?.trim() && !pass) return null;
    return nodemailer.createTransport({
      host: row.smtpHost,
      port: row.smtpPort,
      secure: row.mailSecure || row.smtpPort === 465,
      auth:
        row.smtpUser?.trim() && pass
          ? { user: row.smtpUser.trim(), pass }
          : undefined,
    });
  }

  async getFromAddress(moduleSlug: string): Promise<string | null> {
    const [r] = await this.db
      .select({
        f: moduleSmtpSettings.smtpFrom,
        h: moduleSmtpSettings.smtpHost,
      })
      .from(moduleSmtpSettings)
      .where(eq(moduleSmtpSettings.moduleSlug, moduleSlug))
      .limit(1);
    if (!r) return null;
    if (r.h === MODULE_SMTP_USE_ENV_MARKER) {
      return (
        this.config.get<string>('SMTP_FROM')?.trim() ??
        this.config.get<string>('SMTP_USER')?.trim() ??
        null
      );
    }
    return r.f?.trim() ?? null;
  }

  /**
   * Resuelve transporte + remitente para `module_slug` (p. ej. `system` para auth).
   * `null` ⇒ el caller debe usar fallback `.env`.
   */
  async resolveForSend(
    moduleSlug: string,
  ): Promise<{ transporter: nodemailer.Transporter; from: string } | null> {
    const [row] = await this.db
      .select()
      .from(moduleSmtpSettings)
      .where(eq(moduleSmtpSettings.moduleSlug, moduleSlug))
      .limit(1);
    if (!row || row.smtpHost === MODULE_SMTP_USE_ENV_MARKER) return null;
    if (!isSettingsEncryptionConfigured()) return null;
    const pass = row.smtpPassEncrypted?.trim()
      ? decryptSettingSecret(row.smtpPassEncrypted)
      : undefined;
    if (row.smtpUser?.trim() && !pass) return null;
    const from = row.smtpFrom?.trim();
    if (!from) return null;
    const transporter = nodemailer.createTransport({
      host: row.smtpHost,
      port: row.smtpPort,
      secure: row.mailSecure || row.smtpPort === 465,
      auth:
        row.smtpUser?.trim() && pass
          ? { user: row.smtpUser.trim(), pass }
          : undefined,
    });
    return { transporter, from };
  }

  /**
   * Envía correo usando SMTP del módulo o, si aplica, `SMTP_*` del `.env`.
   * Usado p. ej. adjunto PDF tras registrar una consulta SO.
   */
  async sendMailForModule(
    moduleSlug: string,
    mail: {
      to: string | string[];
      cc?: string | string[];
      subject: string;
      text?: string;
      html?: string;
      attachments?: {
        filename: string;
        content: Buffer;
        contentType?: string;
      }[];
    },
  ): Promise<void> {
    const resolved = await this.resolveForSend(moduleSlug);
    if (resolved) {
      await resolved.transporter.sendMail({
        from: resolved.from,
        to: mail.to,
        cc: mail.cc,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: mail.attachments,
      });
      return;
    }

    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from =
      (await this.getFromAddress(moduleSlug))?.trim() ||
      this.config.get<string>('SMTP_FROM')?.trim() ||
      user?.trim();
    if (!host || !port || !from) {
      throw new NotFoundException({
        message:
          'No hay SMTP configurado para el módulo ni SMTP_HOST/SMTP_PORT/SMTP_FROM en el servidor.',
      });
    }
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    await transporter.sendMail({
      from,
      to: mail.to,
      cc: mail.cc,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments,
    });
  }
}
