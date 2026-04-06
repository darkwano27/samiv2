import { HTTPError } from 'ky';
import { httpClient } from '@/infrastructure/http/client';
import type { AuthRepository } from './auth.repository';
import type { IdentifyResult, LoginResult } from '../types/auth.types';

type IdentifyDto = {
  found: boolean;
  auth_type?: 'ad' | 'local' | 'new-local';
  worker_name?: string;
  message?: string;
};

type LoginDto = {
  requires_password_change: boolean;
  token?: string;
  temp_token?: string;
};

type MsgDto = { message?: string };

async function readErrorMessage(err: unknown): Promise<string | undefined> {
  if (!(err instanceof HTTPError)) return undefined;
  try {
    const body = (await err.response.json()) as MsgDto & {
      errors?: unknown;
    };
    return body.message;
  } catch {
    return undefined;
  }
}

type OrgUnitDto = { code: string; name: string | null } | null;

type AppRoleDto = {
  app_slug: string;
  module_slug: string;
  role_slug: string;
  role_level: number;
  scope: 'global' | 'division' | 'subdivision';
  scope_id: string | null;
  permissions: Record<string, string[]>;
};

type MeDto = {
  sap_code: string;
  worker_name: string;
  worker_id: string;
  division: OrgUnitDto;
  subdivision: OrgUnitDto;
  is_superadmin: boolean;
  app_roles: AppRoleDto[];
  managed_module_slugs?: string[];
};

function mapOrgUnit(d: OrgUnitDto) {
  if (!d) return null;
  return { code: d.code, name: d.name };
}

function mapAppRole(r: AppRoleDto) {
  return {
    appSlug: r.app_slug,
    moduleSlug: r.module_slug,
    roleSlug: r.role_slug,
    roleLevel: r.role_level,
    scope: r.scope,
    scopeId: r.scope_id,
    permissions: r.permissions ?? {},
  };
}

export class AuthApiRepository implements AuthRepository {
  async getMe() {
    try {
      const data = await httpClient.get('auth/me').json<MeDto>();
      return {
        sapCode: data.sap_code,
        workerName: data.worker_name,
        workerId: data.worker_id ?? data.sap_code,
        division: mapOrgUnit(data.division ?? null),
        subdivision: mapOrgUnit(data.subdivision ?? null),
        isSuperadmin: data.is_superadmin ?? false,
        appRoles: (data.app_roles ?? []).map(mapAppRole),
        managedModuleSlugs: data.managed_module_slugs ?? [],
      };
    } catch (e) {
      if (e instanceof HTTPError && e.response.status === 401) {
        return null;
      }
      throw e;
    }
  }

  async logout() {
    await httpClient.post('auth/logout').json();
  }

  async identify(sapCode: string): Promise<IdentifyResult> {
    try {
      const data = await httpClient
        .post('auth/identify', { json: { sap_code: sapCode } })
        .json<IdentifyDto>();
      return {
        found: data.found,
        authType: data.auth_type,
        workerName: data.worker_name,
        message: data.message,
      };
    } catch (e) {
      const msg = await readErrorMessage(e);
      throw new Error(msg ?? 'No se pudo identificar el código');
    }
  }

  async login(sapCode: string, password: string): Promise<LoginResult> {
    try {
      const data = await httpClient
        .post('auth/login', { json: { sap_code: sapCode, password } })
        .json<LoginDto>();
      return {
        requiresPasswordChange: data.requires_password_change,
        token: data.token,
        tempToken: data.temp_token,
      };
    } catch (e) {
      const msg = await readErrorMessage(e);
      throw new Error(msg ?? 'Credenciales incorrectas');
    }
  }

  async register(sapCode: string, dni: string) {
    try {
      const data = await httpClient
        .post('auth/register', { json: { sap_code: sapCode, dni } })
        .json<{ masked_email: string; message: string }>();
      return { maskedEmail: data.masked_email, message: data.message };
    } catch (e) {
      const msg = await readErrorMessage(e);
      throw new Error(msg ?? 'No se pudo completar el registro');
    }
  }

  async recover(sapCode: string, dni: string) {
    try {
      const data = await httpClient
        .post('auth/recover', { json: { sap_code: sapCode, dni } })
        .json<{ masked_email: string; message: string }>();
      return { maskedEmail: data.masked_email, message: data.message };
    } catch (e) {
      const msg = await readErrorMessage(e);
      throw new Error(msg ?? 'No se pudo recuperar la contraseña');
    }
  }

  async changePassword(
    tempToken: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    try {
      const data = await httpClient
        .post('auth/change-password', {
          json: {
            temp_token: tempToken,
            new_password: newPassword,
            confirm_password: confirmPassword,
          },
        })
        .json<{ token: string }>();
      return { token: data.token };
    } catch (e) {
      const msg = await readErrorMessage(e);
      throw new Error(msg ?? 'No se pudo cambiar la contraseña');
    }
  }
}

export const authRepository = new AuthApiRepository();
