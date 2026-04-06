import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionService } from '@modules/auth/services/session.service';
import { PermissionCacheService } from '../services/permission-cache.service';

/**
 * Exige cookie `sami_session` válida y `is_superadmin` en caché RBAC.
 * Usar en controllers bajo `/admin` (no usa `@RequirePermission`).
 */
@Injectable()
export class SuperadminGuard implements CanActivate {
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
    if (!cached.isSuperadmin) {
      throw new ForbiddenException({
        message: 'Solo superadmin puede usar esta ruta',
      });
    }
    return true;
  }
}
