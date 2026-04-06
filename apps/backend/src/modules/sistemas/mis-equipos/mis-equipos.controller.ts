import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SessionService } from '@modules/auth/services/session.service';
import { RequirePermission } from '@modules/rbac/decorators/require-permission.decorator';
import { AsignacionBienesService } from '../asignacion-bienes/asignacion-bienes.service';

@Controller('sistemas/mis-equipos')
export class MisEquiposController {
  constructor(
    private readonly asignacion: AsignacionBienesService,
    private readonly sessions: SessionService,
  ) {}

  private async sapFromReq(req: Request): Promise<string> {
    const token = req.cookies?.sami_session as string | undefined;
    const session = await this.sessions.validateSession(token);
    const cod = session?.sapCode?.trim();
    if (!cod) {
      throw new UnauthorizedException({ message: 'No autenticado' });
    }
    return cod;
  }

  @Get('assets')
  @RequirePermission('mis-equipos', 'listar', 'read')
  async myAssets(@Req() req: Request) {
    const cod = await this.sapFromReq(req);
    return this.asignacion.getAssetsByWorkerCode(cod);
  }

  @Get('glpi-user')
  @RequirePermission('mis-equipos', 'listar', 'read')
  async myGlpiUser(@Req() req: Request) {
    const cod = await this.sapFromReq(req);
    return this.asignacion.getGlpiUserInfo(cod);
  }
}
