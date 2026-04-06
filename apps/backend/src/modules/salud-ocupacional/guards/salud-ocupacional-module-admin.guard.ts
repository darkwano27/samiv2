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

const MODULE_SLUG = 'salud-ocupacional';

/**
 * Cookie de sesión válida y (`is_superadmin` o `managed_module_slugs` incluye Salud Ocupacional).
 * Usado en `salud-ocupacional/module-settings/*` (no sustituye a superadmin en `/api/admin/*`).
 */
@Injectable()
export class SaludOcupacionalModuleAdminGuard implements CanActivate {
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
    if (managed.includes(MODULE_SLUG)) {
      return true;
    }
    throw new ForbiddenException({
      message: 'Solo superadmin o administradores del módulo Salud Ocupacional',
    });
  }
}
