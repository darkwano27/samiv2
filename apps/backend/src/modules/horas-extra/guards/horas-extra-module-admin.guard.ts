import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionService } from '@modules/auth/services/session.service';
import { PermissionCacheService } from '@modules/rbac/services/permission-cache.service';
import { MODULE_SLUG_HORAS_EXTRA } from '../workforce-aris.constants';

/**
 * Sesión válida y (superadmin o admin del módulo WorkForce / horas-extra).
 */
@Injectable()
export class HorasExtraModuleAdminGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.cookies?.sami_session as string | undefined;
    const session = await this.sessions.validateSession(token);
    if (!session) {
      throw new UnauthorizedException({ message: 'No autenticado' });
    }
    const cached = await this.permissionCache.getOrResolve(session.sapCode);
    if (cached.isSuperadmin) {
      return true;
    }
    const managed = cached.managedModuleSlugs ?? [];
    if (managed.includes(MODULE_SLUG_HORAS_EXTRA)) {
      return true;
    }
    throw new ForbiddenException({
      message: 'Solo superadmin o administradores del módulo WorkForce',
    });
  }
}
