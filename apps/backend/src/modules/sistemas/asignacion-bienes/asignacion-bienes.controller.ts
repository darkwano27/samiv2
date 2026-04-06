import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ZodValidationPipe } from '@core/common/pipes/zod-validation.pipe';
import { O365GraphSharepointService } from '@core/sharepoint/o365-graph-sharepoint.service';
import { RequirePermission } from '@modules/rbac/decorators/require-permission.decorator';
import { z } from 'zod';
import {
  actaBienesBodySchema,
  actaBienesEmailBodySchema,
  type ActaBienesBody,
  type ActaBienesEmailBody,
} from './asignacion-bienes-acta.schema';
import { AsignacionBienesActaService } from './asignacion-bienes-acta.service';
import { AsignacionBienesService } from './asignacion-bienes.service';

const sharepointUploadBodySchema = z.object({
  pdf_base64: z.string().min(1),
  file_name: z.string().min(1).max(255),
  worker_code: z.string().min(1).max(32),
});

type SharepointUploadBody = z.infer<typeof sharepointUploadBodySchema>;

@Controller('sistemas/asignacion-bienes')
export class AsignacionBienesController {
  constructor(
    private readonly asignacion: AsignacionBienesService,
    private readonly acta: AsignacionBienesActaService,
    private readonly sharepoint: O365GraphSharepointService,
  ) {}

  @Get('sap-search')
  @RequirePermission('asignacion-bienes', 'operar', 'read')
  sapSearch(@Query('q') q?: string) {
    return this.asignacion.searchSap(q ?? '');
  }

  @Get('glpi-user/:cod')
  @RequirePermission('asignacion-bienes', 'operar', 'read')
  glpiUser(@Param('cod') cod: string) {
    return this.asignacion.getGlpiUserInfo(decodeURIComponent(cod.trim()));
  }

  @Get('assets/:cod')
  @RequirePermission('asignacion-bienes', 'operar', 'read')
  assets(@Param('cod') cod: string) {
    return this.asignacion.getAssetsByWorkerCode(decodeURIComponent(cod.trim()));
  }

  @Get('sap-org/:cod')
  @RequirePermission('asignacion-bienes', 'operar', 'read')
  sapOrg(@Param('cod') cod: string) {
    return this.asignacion.getSapWorkerOrgSnapshot(decodeURIComponent(cod.trim()));
  }

  @Post('acta/pdf')
  @RequirePermission('asignacion-bienes', 'operar', 'create')
  actaPdf(@Body(new ZodValidationPipe(actaBienesBodySchema)) body: ActaBienesBody) {
    return this.acta.buildPdfBase64(body);
  }

  @Post('acta/email')
  @RequirePermission('asignacion-bienes', 'operar', 'create')
  async actaEmail(@Body(new ZodValidationPipe(actaBienesEmailBodySchema)) body: ActaBienesEmailBody) {
    await this.acta.sendActaByEmail(body);
    return { ok: true as const };
  }

  @Post('acta/sharepoint')
  @RequirePermission('asignacion-bienes', 'operar', 'create')
  actaSharepoint(@Body(new ZodValidationPipe(actaBienesBodySchema)) body: ActaBienesBody) {
    return this.acta.uploadActaToSharepoint(body);
  }

  @Post('sharepoint-upload')
  @RequirePermission('asignacion-bienes', 'operar', 'create')
  async sharepointUpload(
    @Body(new ZodValidationPipe(sharepointUploadBodySchema)) body: SharepointUploadBody,
  ) {
    let buf: Buffer;
    try {
      buf = Buffer.from(body.pdf_base64, 'base64');
    } catch {
      throw new BadRequestException({ message: 'pdf_base64 no es Base64 válido.' });
    }
    if (buf.length === 0) {
      throw new BadRequestException({ message: 'PDF vacío.' });
    }
    return this.sharepoint.uploadPdf({
      pdfBuffer: buf,
      fileName: body.file_name.trim(),
      workerCode: body.worker_code.trim(),
    });
  }
}
