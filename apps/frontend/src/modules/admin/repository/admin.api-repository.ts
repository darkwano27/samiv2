import type { QueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { httpClient } from '@/infrastructure/http/client';
import type {
  SoModuleEmailSettings,
  SoModuleEmailSettingsPatch,
} from '@/modules/salud-ocupacional/ajustes/repository/so-module-settings.api-repository';
import type { ModulesSummaryResponse } from '@/modules/admin/types/modules-summary.types';
import type { RbacCatalogResponse } from '@/modules/admin/types/rbac-catalog.types';
import type { WorkersDirectoryResponse } from '@/modules/admin/types/worker-directory.types';

/** Mensaje de error de cuerpo JSON Nest (`{ message: string | string[] }`). */
export async function readAdminServerMessage(e: unknown): Promise<string | undefined> {
  if (!(e instanceof HTTPError)) return undefined;
  try {
    const b = (await e.response.json()) as { message?: string | string[] };
    if (typeof b.message === 'string') return b.message;
    if (Array.isArray(b.message)) return b.message.join(', ');
  } catch {
    /* ignore */
  }
  return undefined;
}

export async function fetchWorkersDirectory(): Promise<WorkersDirectoryResponse> {
  return httpClient.get('admin/workers/directory').json<WorkersDirectoryResponse>();
}

/** SMTP global (`module_slug = system`): auth, recuperación, etc. */
export async function fetchAdminSystemEmailSettings() {
  return httpClient.get('admin/settings/email').json<SoModuleEmailSettings | null>();
}

export async function patchAdminSystemEmailSettings(body: SoModuleEmailSettingsPatch) {
  return httpClient
    .patch('admin/settings/email', { json: body })
    .json<SoModuleEmailSettings>();
}

export async function postAdminSystemEmailTest(to: string) {
  return httpClient
    .post('admin/settings/email/test', { json: { to: to.trim() } })
    .json<{ sent: true }>();
}

export async function invalidateAdminSettingsQueries(qc: QueryClient) {
  await qc.invalidateQueries({ queryKey: ['admin', 'settings', 'email'] });
}

export async function fetchModulesSummary(): Promise<ModulesSummaryResponse> {
  return httpClient.get('admin/rbac/modules-summary').json<ModulesSummaryResponse>();
}

export async function fetchRbacCatalog(): Promise<RbacCatalogResponse> {
  return httpClient.get('admin/rbac/catalog').json<RbacCatalogResponse>();
}

export async function assignWorkerRole(body: {
  worker_id: string;
  role_id: string;
}): Promise<{ id?: string; worker_id: string; role_id: string }> {
  return httpClient.post('admin/rbac/worker-assignments', { json: body }).json();
}

export async function revokeRbacAssignment(assignmentId: string): Promise<{
  revoked: true;
  assignment_id: string;
}> {
  const id = assignmentId.trim();
  const res = await httpClient.delete(`admin/rbac/assignments/${encodeURIComponent(id)}`);
  const text = (await res.text()).trim();
  if (!text) {
    return { revoked: true, assignment_id: id };
  }
  try {
    return JSON.parse(text) as { revoked: true; assignment_id: string };
  } catch {
    return { revoked: true, assignment_id: id };
  }
}

export async function unlockLocalAuth(sapCode: string): Promise<{
  sap_code: string;
  unlocked: true;
}> {
  return httpClient
    .post(`admin/workers/${encodeURIComponent(sapCode)}/unlock-local-auth`)
    .json();
}

export function isForbiddenError(e: unknown): boolean {
  return e instanceof HTTPError && e.response.status === 403;
}

export function isServiceUnavailableError(e: unknown): boolean {
  return e instanceof HTTPError && e.response.status === 503;
}

export function isConflictError(e: unknown): boolean {
  return e instanceof HTTPError && e.response.status === 409;
}

export function isNotFoundError(e: unknown): boolean {
  return e instanceof HTTPError && e.response.status === 404;
}
