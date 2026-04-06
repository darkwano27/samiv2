import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionService } from '@modules/auth/services/session.service';
import { RBAC_PERMISSION_METADATA_KEY } from '../rbac.constants';
import type { RequirePermissionMeta } from '../decorators/require-permission.decorator';
import { PermissionCacheService } from '../services/permission-cache.service';
import { RbacService } from '../services/rbac.service';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly permissionCache: PermissionCacheService,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<RequirePermissionMeta>(
      RBAC_PERMISSION_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const token = req.cookies?.sami_session as string | undefined;
    const session = await this.sessions.validateSession(token);
    if (!session) {
      throw new UnauthorizedException({ message: 'No autenticado' });
    }

    const cached = await this.permissionCache.getOrResolve(session.sapCode);
    const allowed = await this.rbacService.canAccess(
      cached,
      meta.appSlug,
      meta.featureSlug,
      meta.action,
    );
    if (!allowed) {
      throw new ForbiddenException({ message: 'Sin permiso para esta acción' });
    }
    return true;
  }
}
