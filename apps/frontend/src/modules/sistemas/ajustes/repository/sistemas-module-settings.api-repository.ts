import type { QueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { httpClient } from '@/infrastructure/http/client';

/** Reutilizamos las mismas formas que Salud ocupacional; solo cambia el prefijo de ruta API. */
export type {
  SoModuleAssignment,
  SoModuleEmailSettings,
  SoModuleEmailSettingsPatch,
  SoMatrixCell,
  SoMemberAppAccess,
  SoMemberAppNoAccess,
  SoMemberDetail,
  SoModuleMember,
  SoModuleMembersPage,
  SoModuleProfileCounts,
  SoModuleProfileDetail,
  SoModuleProfileRow,
  SoModuleRbacApp,
  SoModuleRbacCatalog,
  SoModuleRbacFeature,
  SoModuleRbacRole,
  SoProfileActionCatalogApp,
} from '@/modules/salud-ocupacional/ajustes/repository/so-module-settings.api-repository';

import type {
  SoModuleAssignment,
  SoModuleEmailSettings,
  SoModuleEmailSettingsPatch,
  SoModuleMembersPage,
  SoModuleProfileDetail,
  SoModuleRbacCatalog,
  SoMatrixCell,
  SoMemberDetail,
  SoModuleProfileRow,
  SoProfileActionCatalogApp,
} from '@/modules/salud-ocupacional/ajustes/repository/so-module-settings.api-repository';

const BASE = 'sistemas/module-settings';

export async function sisFetchModuleRbacCatalog(): Promise<SoModuleRbacCatalog> {
  return httpClient.get(`${BASE}/rbac-catalog`).json<SoModuleRbacCatalog>();
}

export async function sisFetchProfileActionCatalog() {
  return httpClient
    .get(`${BASE}/profile-action-catalog`)
    .json<{ apps: SoProfileActionCatalogApp[] }>();
}

export async function sisFetchWorkerLookup(q: string) {
  const sp = new URLSearchParams();
  if (q.trim()) sp.set('q', q.trim());
  const qs = sp.toString();
  return httpClient
    .get(qs ? `${BASE}/worker-lookup?${qs}` : `${BASE}/worker-lookup`)
    .json<{ suggestions: { sap_code: string; name: string }[] }>();
}

export async function sisFetchWorkerAssignmentsInModule(workerId: string) {
  const id = workerId.trim();
  return httpClient
    .get(`${BASE}/workers/${encodeURIComponent(id)}/assignments`)
    .json<{ worker_id: string; assignments: SoModuleAssignment[] }>();
}

export async function sisFetchModuleMembers(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<SoModuleMembersPage> {
  const sp = new URLSearchParams();
  if (params?.search?.trim()) sp.set('search', params.search.trim());
  if (params?.page != null) sp.set('page', String(params.page));
  if (params?.limit != null) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  const url = qs ? `${BASE}/members?${qs}` : `${BASE}/members`;
  return httpClient.get(url).json<SoModuleMembersPage>();
}

export async function sisFetchModuleProfiles() {
  return httpClient
    .get(`${BASE}/module-profiles`)
    .json<{ profiles: SoModuleProfileRow[] }>();
}

export async function sisFetchModuleProfileDetail(profileId: string) {
  return httpClient
    .get(`${BASE}/module-profiles/${encodeURIComponent(profileId)}`)
    .json<SoModuleProfileDetail>();
}

export async function sisCreateModuleProfile(body: {
  label: string;
  description?: string | null;
  slug?: string | null;
  app_permissions: { app_slug: string; actions: string[] }[];
}) {
  return httpClient
    .post(`${BASE}/module-profiles`, { json: body })
    .json<{ id: string; slug: string; label: string; description: string | null; role_count: number }>();
}

export async function sisUpdateModuleProfile(
  profileId: string,
  body: {
    label?: string;
    description?: string | null;
    app_permissions?: { app_slug: string; actions: string[] }[];
  },
) {
  return httpClient
    .patch(`${BASE}/module-profiles/${encodeURIComponent(profileId)}`, {
      json: body,
    })
    .json<{ ok: true; id: string; note?: string }>();
}

export async function sisDeleteModuleProfile(profileId: string) {
  return httpClient
    .delete(`${BASE}/module-profiles/${encodeURIComponent(profileId)}`)
    .json<{ deleted: true; id: string }>();
}

export async function sisFetchPermissionMatrix() {
  return httpClient
    .get(`${BASE}/permission-matrix`)
    .json<{ matrix: SoMatrixCell[] }>();
}

export async function sisApplyModuleProfile(body: {
  worker_id: string;
  profile_slug: string;
}) {
  return httpClient
    .post(`${BASE}/apply-profile`, { json: body })
    .json<{ applied: number; skipped_duplicates: number }>();
}

export async function sisAssignWorkerRoleInModule(body: {
  worker_id: string;
  role_id: string;
}) {
  return httpClient
    .post(`${BASE}/worker-assignments`, { json: body })
    .json<{ id: string; worker_id: string; role_id: string }>();
}

export async function sisRevokeAssignmentInModule(assignmentId: string) {
  return httpClient
    .delete(`${BASE}/assignments/${assignmentId}`)
    .json<{ revoked: true; assignment_id: string }>();
}

export async function sisFetchMemberDetail(workerId: string) {
  const id = workerId.trim();
  return httpClient
    .get(`${BASE}/members/${encodeURIComponent(id)}`)
    .json<SoMemberDetail>();
}

export async function sisRevokeAllInModule(workerId: string) {
  const id = workerId.trim();
  const res = await httpClient.delete(`${BASE}/members/${encodeURIComponent(id)}`);
  const text = (await res.text()).trim();
  if (!text) return { revoked: 0 };
  try {
    return JSON.parse(text) as { revoked: number };
  } catch {
    return { revoked: 0 };
  }
}

export async function sisReplaceMemberProfile(workerId: string, profile_slug: string) {
  const id = workerId.trim();
  return httpClient
    .post(`${BASE}/members/${encodeURIComponent(id)}/profile`, {
      json: { profile_slug },
    })
    .json<{ applied: number; skipped_duplicates: number }>();
}

export async function sisFetchModuleEmailSettings() {
  return httpClient.get(`${BASE}/email-settings`).json<SoModuleEmailSettings | null>();
}

export async function sisPatchModuleEmailSettings(body: SoModuleEmailSettingsPatch) {
  return httpClient.patch(`${BASE}/email-settings`, { json: body }).json<SoModuleEmailSettings>();
}

export async function sisPostModuleEmailTest(to: string) {
  return httpClient
    .post(`${BASE}/email-settings/test`, { json: { to: to.trim() } })
    .json<{ sent: true }>();
}

export type SisModuleGlpiPublicSettings = {
  module_slug: string;
  glpi_db_host: string;
  glpi_db_port: number;
  glpi_db_user: string;
  glpi_db_name: string;
  glpi_db_pass_configured: boolean;
};

export type SisModuleGlpiSettingsPatch = {
  glpi_db_host: string;
  glpi_db_port: number;
  glpi_db_user: string;
  glpi_db_name: string;
  glpi_db_pass?: string;
};

export type SisModuleGlpiTestBody = {
  glpi_db_host?: string;
  glpi_db_port?: number;
  glpi_db_user?: string;
  glpi_db_name?: string;
  glpi_db_pass?: string;
};

export async function sisFetchGlpiSettings() {
  return httpClient.get(`${BASE}/glpi-settings`).json<SisModuleGlpiPublicSettings | null>();
}

export async function sisPatchGlpiSettings(body: SisModuleGlpiSettingsPatch) {
  return httpClient.patch(`${BASE}/glpi-settings`, { json: body }).json<SisModuleGlpiPublicSettings>();
}

export async function sisPostGlpiConnectionTest(body: SisModuleGlpiTestBody = {}) {
  return httpClient.post(`${BASE}/glpi-settings/test`, { json: body }).json<{ ok: true }>();
}

export type SisModuleSharepointPublicSettings = {
  module_slug: string;
  tenant_id: string | null;
  client_id: string | null;
  client_secret_configured: boolean;
  site_path: string | null;
  drive_name: string | null;
  parent_folder: string | null;
  public_host: string | null;
};

export type SisModuleSharepointPatch = {
  tenant_id?: string;
  client_id?: string;
  client_secret?: string;
  site_path?: string;
  drive_name?: string;
  parent_folder?: string;
  public_host?: string;
};

export async function sisFetchSharepointSettings() {
  return httpClient
    .get(`${BASE}/sharepoint-settings`)
    .json<SisModuleSharepointPublicSettings | null>();
}

export async function sisPatchSharepointSettings(body: SisModuleSharepointPatch) {
  return httpClient
    .patch(`${BASE}/sharepoint-settings`, { json: body })
    .json<SisModuleSharepointPublicSettings>();
}

export async function sisPostSharepointConnectionTest() {
  return httpClient
    .post(`${BASE}/sharepoint-settings/test`, { json: {} })
    .json<{ ok: true }>();
}

export async function invalidateSisModuleSettingsRelatedQueries(qc: QueryClient) {
  await qc.invalidateQueries({ queryKey: ['sistemas', 'module-settings', 'members'] });
  await qc.invalidateQueries({ queryKey: ['sistemas', 'module-settings', 'module-profiles'] });
  await qc.invalidateQueries({ queryKey: ['sistemas', 'module-settings', 'profile-action-catalog'] });
  await qc.invalidateQueries({ queryKey: ['sistemas', 'module-settings', 'email-settings'] });
  await qc.invalidateQueries({ queryKey: ['sistemas', 'module-settings', 'glpi-settings'] });
  await qc.invalidateQueries({ queryKey: ['sistemas', 'module-settings', 'sharepoint-settings'] });
  await qc.invalidateQueries({ queryKey: ['admin', 'rbac', 'modules-summary'] });
}

export async function invalidateSisMemberDetailAndRelated(qc: QueryClient, workerId: string | null) {
  await invalidateSisModuleSettingsRelatedQueries(qc);
  if (workerId) {
    await qc.invalidateQueries({
      queryKey: ['sistemas', 'module-settings', 'member-detail', workerId],
    });
  }
}

export async function readSisModuleSettingsMessage(e: unknown): Promise<string | undefined> {
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
