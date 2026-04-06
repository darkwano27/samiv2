import { BadRequestException, Injectable } from '@nestjs/common';
import type { ResolvedGraphSharepointConfig } from './module-sharepoint.service';
import { ModuleSharepointService } from './module-sharepoint.service';

type GraphTokenResponse = { access_token: string };

/**
 * Subida de PDF a SharePoint vía Microsoft Graph (client credentials).
 * Credenciales: fila `module_sharepoint_settings` del módulo y/o variables O365_*.
 */
@Injectable()
export class O365GraphSharepointService {
  constructor(private readonly moduleSharepoint: ModuleSharepointService) {}

  private async getGraphToken(cfg: ResolvedGraphSharepointConfig): Promise<string> {
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
        message: `No se pudo obtener token Graph (${res.status}). ${t.slice(0, 200)}`,
      });
    }
    const data = (await res.json()) as GraphTokenResponse;
    if (!data.access_token) {
      throw new BadRequestException({ message: 'Respuesta Graph sin access_token.' });
    }
    return data.access_token;
  }

  private async getSiteId(accessToken: string, sitePath: string): Promise<string> {
    const url = `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(sitePath)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new BadRequestException({
        message: `No se pudo resolver siteId (${res.status}). ${t.slice(0, 200)}`,
      });
    }
    const data = (await res.json()) as { id: string };
    return data.id;
  }

  private async getDriveId(
    accessToken: string,
    siteId: string,
    driveName: string,
  ): Promise<string> {
    const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new BadRequestException({
        message: `No se pudo listar drives (${res.status}). ${t.slice(0, 200)}`,
      });
    }
    const data = (await res.json()) as { value: { id: string; name: string }[] };
    const drive = data.value?.find((d) => d.name === driveName);
    if (!drive) {
      throw new BadRequestException({
        message: `No se encontró la biblioteca «${driveName}» en el sitio.`,
      });
    }
    return drive.id;
  }

  private async ensureFolder(
    accessToken: string,
    siteId: string,
    driveId: string,
    parentPath: string,
    folderName: string,
  ): Promise<string> {
    const safeParent = parentPath.replace(/^\/+|\/+$/g, '');
    const safeFolder = folderName.replace(/[/\\]/g, '_');
    const relative = `${safeParent}/${safeFolder}`;
    const encoded = this.encodeGraphSegmentPath(relative);
    const getUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encoded}`;
    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (getRes.ok) {
      return relative;
    }
    const parentEncoded = this.encodeGraphSegmentPath(safeParent);
    const createUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${parentEncoded}:/children`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: safeFolder,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      }),
    });
    if (!createRes.ok) {
      const t = await createRes.text();
      throw new BadRequestException({
        message: `No se pudo crear carpeta ${safeFolder} (${createRes.status}). ${t.slice(0, 200)}`,
      });
    }
    return relative;
  }

  private encodeGraphSegmentPath(path: string): string {
    return path
      .split('/')
      .filter(Boolean)
      .map((seg) => encodeURIComponent(seg))
      .join('/');
  }

  /**
   * Sube un PDF y devuelve una URL legible (misma forma que el snippet legado).
   * @param moduleSlug — por defecto `sistemas` (asignación de bienes).
   */
  async uploadPdf(params: {
    pdfBuffer: Buffer;
    fileName: string;
    workerCode: string;
    moduleSlug?: string;
  }): Promise<{ webUrl: string }> {
    const { pdfBuffer, fileName, workerCode } = params;
    const moduleSlug = params.moduleSlug ?? 'sistemas';
    const safeName = fileName.replace(/[/\\]/g, '_');
    if (!safeName.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException({ message: 'El archivo debe ser .pdf' });
    }

    const cfg = await this.moduleSharepoint.resolveGraphConfig(moduleSlug);
    const accessToken = await this.getGraphToken(cfg);
    const siteId = await this.getSiteId(accessToken, cfg.sitePath);
    const driveId = await this.getDriveId(accessToken, siteId, cfg.driveName);
    const folderPath = await this.ensureFolder(
      accessToken,
      siteId,
      driveId,
      cfg.parentPath,
      workerCode.trim().replace(/[/\\]/g, '_'),
    );
    const filePath = this.encodeGraphSegmentPath(`${folderPath}/${safeName}`);
    const putUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${filePath}:/content`;
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/pdf',
      },
      body: new Uint8Array(pdfBuffer),
    });
    if (!putRes.ok) {
      const t = await putRes.text();
      throw new BadRequestException({
        message: `No se pudo subir el PDF (${putRes.status}). ${t.slice(0, 200)}`,
      });
    }
    const base = cfg.publicHost.replace(/\/$/, '');
    const webUrl = `${base}/UA_AF/AF_Sistemas/Documentos/${folderPath}/${safeName}`;
    return { webUrl };
  }
}
