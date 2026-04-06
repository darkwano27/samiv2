import { Injectable, Logger } from '@nestjs/common';
import { registerArisPdfFonts } from '@core/pdf/register-aris-fonts';

/** Árbol raíz `<Document>` de `@react-pdf/renderer` (plantillas por módulo). */
export type PdfDocumentElement = Parameters<
  Awaited<typeof import('@react-pdf/renderer')>['renderToBuffer']
>[0];

/**
 * Motor PDF compartido: **@react-pdf/renderer** (sin Puppeteer ni pdfmake).
 * Las plantillas por módulo son componentes React (`Document` / `Page`) que importan
 * `ArisPdfHeader` / `ArisPdfFooter` desde `@core/pdf/components/ArisShell`.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private fontsReady = false;

  constructor() {
    try {
      registerArisPdfFonts();
      this.fontsReady = true;
    } catch (e) {
      this.logger.warn(
        `Fuentes PDF no registradas: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * Renderiza un árbol React-PDF a `Buffer` (p. ej. para `Content-Type: application/pdf`
   * o adjunto en correo). Usa `renderToBuffer` de la librería (Node).
   */
  async renderToBuffer(document: PdfDocumentElement): Promise<Buffer> {
    const { renderToBuffer } = await import('@react-pdf/renderer');
    return renderToBuffer(document);
  }
}
