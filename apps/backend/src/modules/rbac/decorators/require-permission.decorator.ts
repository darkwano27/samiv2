import { SetMetadata } from '@nestjs/common';
import { RBAC_PERMISSION_METADATA_KEY } from '../rbac.constants';

export type RequirePermissionMeta = {
  appSlug: string;
  featureSlug: string;
  action: string;
};

/**
 * Protege el handler: exige sesión válida (`sami_session`) y permiso explícito.
 * Rutas **sin** este decorador no pasan por la comprobación RBAC del guard global.
 */
export const RequirePermission = (
  appSlug: string,
  featureSlug: string,
  action: string,
) =>
  SetMetadata(RBAC_PERMISSION_METADATA_KEY, {
    appSlug,
    featureSlug,
    action,
  } satisfies RequirePermissionMeta);
