import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { ModuleSmtpService } from '@core/mail/module-smtp.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly moduleSmtp: ModuleSmtpService,
  ) {}

  async sendTempPassword(
    to: string,
    tempPassword: string,
    sapCode: string,
  ): Promise<void> {
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    const emailEnabled = this.config.get<boolean>('EMAIL_ENABLED', false);

    if (nodeEnv === 'development' || !emailEnabled) {
      this.logger.log(`[DEV] Temp password for ${sapCode}: ${tempPassword}`);
      return;
    }

    const resolved = await this.moduleSmtp.resolveForSend('system');
    if (resolved) {
      await resolved.transporter.sendMail({
        from: resolved.from,
        to,
        subject: 'SAMI — Tu contraseña temporal',
        text: `Tu contraseña temporal es: ${tempPassword}`,
      });
      return;
    }

    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from =
      this.config.get<string>('SMTP_FROM')?.trim() || user?.trim() || undefined;

    if (!host || !port || !from) {
      this.logger.warn('[EmailService] SMTP not configured; logging temp password');
      this.logger.log(`[DEV] Temp password for ${sapCode}: ${tempPassword}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({
      from,
      to,
      subject: 'SAMI — Tu contraseña temporal',
      text: `Tu contraseña temporal es: ${tempPassword}`,
    });
  }
}
