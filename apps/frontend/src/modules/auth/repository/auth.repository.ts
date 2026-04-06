import type {
  IdentifyResult,
  LoginResult,
  RecoverResult,
  RegisterResult,
} from '../types/auth.types';

/** Alineado a `GET /auth/me` y `docs/features/auth-me-organization-enrichment.md`. */
export type MeOrganizationUnit = { code: string; name: string | null };

/** Alineado a RBAC en `.kiro/specs/sami-rbac/design.md` (DTO `AppRoleDTO`). */
export type MeAppRoleAssignment = {
  appSlug: string;
  moduleSlug: string;
  roleSlug: string;
  roleLevel: number;
  scope: 'global' | 'division' | 'subdivision';
  scopeId: string | null;
  permissions: Record<string, string[]>;
};

export type MeResult = {
  sapCode: string;
  workerName: string;
  workerId: string;
  division: MeOrganizationUnit | null;
  subdivision: MeOrganizationUnit | null;
  isSuperadmin: boolean;
  appRoles: MeAppRoleAssignment[];
  /**
   * Módulos donde el usuario tiene rol sobre una app `is_management` (p. ej. admin de Salud Ocupacional).
   * Alineado a `managed_module_slugs` en `GET /auth/me` y a `RbacService.resolvePermissions`.
   */
  managedModuleSlugs: string[];
};

export interface AuthRepository {
  getMe(): Promise<MeResult | null>;
  logout(): Promise<void>;
  identify(sapCode: string): Promise<IdentifyResult>;
  login(sapCode: string, password: string): Promise<LoginResult>;
  register(sapCode: string, dni: string): Promise<RegisterResult>;
  recover(sapCode: string, dni: string): Promise<RecoverResult>;
  changePassword(
    tempToken: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<{ token: string }>;
}
