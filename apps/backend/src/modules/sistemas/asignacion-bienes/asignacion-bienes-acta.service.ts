import { Injectable, Logger } from '@nestjs/common';
import { ModuleSmtpService } from '@core/mail/module-smtp.service';
import { getSoPdfLogoImageSrc, resolveSoPdfLogoPath } from '@core/pdf/pdf-assets';
import { PdfService, type PdfDocumentElement } from '@core/services/pdf.service';
import { O365GraphSharepointService } from '@core/sharepoint/o365-graph-sharepoint.service';
import { createElement } from 'react';
import type { ActaBienesBody, ActaBienesEmailBody } from './asignacion-bienes-acta.schema';
import { ActaBienesPdfDocument } from './pdf/ActaBienesPdfDocument';

const SISTEMAS_MODULE_SLUG = 'sistemas';

function safeActaFileName(body: ActaBienesBody): string {
  const sap = body.worker_sap.trim().replace(/[^\w.-]+/g, '_');
  const kind = body.report_kind === 'entrega' ? 'entrega' : 'devolucion';
  return `${sap}_${body.act_date}_acta_${kind}.pdf`;
}

@Injectable()
export class AsignacionBienesActaService {
  private readonly logger = new Logger(AsignacionBienesActaService.name);

  constructor(
    private readonly pdf: PdfService,
    private readonly moduleSmtp: ModuleSmtpService,
    private readonly sharepoint: O365GraphSharepointService,
  ) {}

  private async renderPdf(body: ActaBienesBody): Promise<Buffer> {
    const logoPath = resolveSoPdfLogoPath();
    const logoSrc = getSoPdfLogoImageSrc();
    if (!logoSrc && logoPath) {
      this.logger.warn(`Logo PDF presente en disco pero no cargable: ${logoPath}`);
    }
    return this.pdf.renderToBuffer(
      createElement(ActaBienesPdfDocument, {
        payload: body,
        logoSrc,
      }) as PdfDocumentElement,
    );
  }

  async buildPdfBase64(body: ActaBienesBody): Promise<{ pdf_base64: string; file_name: string }> {
    const buffer = await this.renderPdf(body);
    return {
      pdf_base64: buffer.toString('base64'),
      file_name: safeActaFileName(body),
    };
  }

  async sendActaByEmail(body: ActaBienesEmailBody): Promise<void> {
    const { to, ...acta } = body;
    const buffer = await this.renderPdf(acta);
    const filename = safeActaFileName(acta);
    const kindLabel =
      acta.report_kind === 'entrega' ? 'Entrega de bienes' : 'Devolución de bienes';
    const worker = acta.worker_name.trim();

    await this.moduleSmtp.sendMailForModule(SISTEMAS_MODULE_SLUG, {
      to: to.trim(),
      subject: `Acta de ${kindLabel.toLowerCase()} — SAMI`,
      text: [
        `Estimado/a ${worker},`,
        '',
        `Adjuntamos el acta de ${kindLabel.toLowerCase()} generada desde SAMI (módulo Sistemas).`,
        '',
        `Fecha del trámite: ${acta.act_date}`,
        `SAP: ${acta.worker_sap}`,
        '',
        'Conservá este documento como respaldo del trámite.',
        '',
        'Saludos,',
        'Sistemas — ARIS',
      ].join('\n'),
      attachments: [
        { filename, content: buffer, contentType: 'application/pdf' },
      ],
    });
  }

  /** Una sola generación de PDF y subida Graph (evita doble render en el cliente). */
  async uploadActaToSharepoint(body: ActaBienesBody): Promise<{ webUrl: string }> {
    const buffer = await this.renderPdf(body);
    const fileName = safeActaFileName(body);
    return this.sharepoint.uploadPdf({
      pdfBuffer: buffer,
      fileName,
      workerCode: body.worker_sap.trim(),
    });
  }
}
