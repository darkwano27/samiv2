import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UnauthorizedException,
  UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { ZodValidationPipe } from '@core/common/pipes/zod-validation.pipe';
import { SessionService } from '@modules/auth/services/session.service';
import { RequirePermission } from '@modules/rbac/decorators/require-permission.decorator';
import { PermissionCacheService } from '@modules/rbac/services/permission-cache.service';
import {
  createHeBoletaBodySchema,
  type CreateHeBoletaBody,
} from './dto/registro-horas-extra.dto';
import { AprobacionHorasExtraService } from './aprobacion-horas-extra.service';
import { RegistroHorasExtraService } from './registro-horas-extra.service';

@Controller('horas-extra/registro')
export class RegistroHorasExtraController {
  constructor(
    private readonly registro: RegistroHorasExtraService,
    private readonly bandeja: AprobacionHorasExtraService,
    private readonly sessions: SessionService,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  /** Superadmin o administrador del módulo WorkForce ven todo el organigrama ARIS. */
  private async requireSapAndAccess(req: Request): Promise<{
    sapCode: string;
    fullOrgAccess: boolean;
  }> {
    const token = req.cookies?.sami_session as string | undefined;
    const session = await this.sessions.validateSession(token);
    if (!session) {
      throw new UnauthorizedException({ message: 'Tenés que iniciar sesión de nuevo.' });
    }
    const sapCode = session.sapCode.trim();
    const cached = await this.permissionCache.getOrResolve(sapCode);
    const fullOrgAccess =
      cached.isSuperadmin || cached.managedModuleSlugs.includes('horas-extra');
    return { sapCode, fullOrgAccess };
  }

  @Get('motivos')
  @RequirePermission('registro-horas-extra', 'boletas', 'read')
  listMotivos() {
    return this.registro.listMotivos();
  }

  @Get('supervisor-scope')
  @RequirePermission('registro-horas-extra', 'boletas', 'read')
  async supervisorScope(@Req() req: Request) {
    const { sapCode, fullOrgAccess } = await this.requireSapAndAccess(req);
    return this.registro.getSupervisorScope(sapCode, fullOrgAccess);
  }

  @Get('workers-search')
  @RequirePermission('registro-horas-extra', 'boletas', 'read')
  async workersSearch(
    @Req() req: Request,
    @Query('q') q?: string,
    @Query('division_code') divisionCode?: string,
    @Query('subdivision_codes') subdivisionCodesRaw?: string,
  ) {
    const { sapCode, fullOrgAccess } = await this.requireSapAndAccess(req);
    const subs = (subdivisionCodesRaw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.registro.searchWorkersInSubdivisions(
      sapCode,
      fullOrgAccess,
      q ?? '',
      divisionCode ?? '',
      subs,
    );
  }

  @Post('boletas')
  @RequirePermission('registro-horas-extra', 'boletas', 'create')
  @UsePipes(new ZodValidationPipe(createHeBoletaBodySchema))
  async createBoleta(@Req() req: Request, @Body() body: CreateHeBoletaBody) {
    const { sapCode, fullOrgAccess } = await this.requireSapAndAccess(req);
    return this.registro.createBoleta(sapCode, fullOrgAccess, body);
  }

  /** Bandeja por cabecera (supervisor): mismo alcance que aprobación, permiso de registro/boletas. */
  @Get('boletas-bandeja')
  @RequirePermission('registro-horas-extra', 'boletas', 'read')
  async listBoletasBandeja(
    @Req() req: Request,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('page') pageRaw?: string,
    @Query('page_size') pageSizeRaw?: string,
    @Query('worker_q') workerQ?: string,
    @Query('boleta_q') boletaQ?: string,
    @Query('creator_q') creatorQ?: string,
    @Query('subdivision_codes') subdivisionCodesRaw?: string,
    @Query('status') statusRaw?: string,
  ) {
    const { sapCode, fullOrgAccess } = await this.requireSapAndAccess(req);
    const df = (dateFrom ?? '').trim();
    const dt = (dateTo ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(df) || !/^\d{4}-\d{2}-\d{2}$/.test(dt)) {
      return { items: [], total: 0, page: 1, page_size: 20 };
    }
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeRaw ?? '20', 10) || 20));
    const subdivisionCodes = (subdivisionCodesRaw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const statusCodes = (statusRaw ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return this.bandeja.listBandejaHeadersPage(sapCode, fullOrgAccess, {
      dateFrom: df,
      dateTo: dt,
      page,
      pageSize,
      workerQ: (workerQ ?? '').trim() || undefined,
      boletaQ: (boletaQ ?? '').trim() || undefined,
      creatorQ: (creatorQ ?? '').trim() || undefined,
      subdivisionCodes: subdivisionCodes.length ? subdivisionCodes : undefined,
      statusCodes: statusCodes.length ? statusCodes : undefined,
    });
  }

  @Get('boletas/:headerId')
  @RequirePermission('registro-horas-extra', 'boletas', 'read')
  async getBoleta(@Req() req: Request, @Param('headerId', ParseUUIDPipe) headerId: string) {
    const { sapCode, fullOrgAccess } = await this.requireSapAndAccess(req);
    return this.bandeja.getBoletaDetail(sapCode, fullOrgAccess, headerId);
  }

  @Get('boletas/:headerId/pdf')
  @RequirePermission('registro-horas-extra', 'boletas', 'read')
  async getBoletaPdf(@Req() req: Request, @Param('headerId', ParseUUIDPipe) headerId: string) {
    const { sapCode, fullOrgAccess } = await this.requireSapAndAccess(req);
    const { buffer, filename } = await this.bandeja.renderApprovedBoletaPdf(
      sapCode,
      fullOrgAccess,
      headerId,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Patch('boletas/:headerId')
  @RequirePermission('registro-horas-extra', 'boletas', 'update')
  @UsePipes(new ZodValidationPipe(createHeBoletaBodySchema))
  async patchBoleta(
    @Req() req: Request,
    @Param('headerId', ParseUUIDPipe) headerId: string,
    @Body() body: CreateHeBoletaBody,
  ) {
    const { sapCode, fullOrgAccess } = await this.requireSapAndAccess(req);
    return this.registro.updateBoleta(sapCode, fullOrgAccess, headerId, body);
  }

  @Delete('boletas/:headerId')
  @RequirePermission('registro-horas-extra', 'boletas', 'delete')
  async deleteBoleta(@Req() req: Request, @Param('headerId', ParseUUIDPipe) headerId: string) {
    const { sapCode, fullOrgAccess } = await this.requireSapAndAccess(req);
    return this.bandeja.anularBoleta(sapCode, fullOrgAccess, headerId);
  }
}
