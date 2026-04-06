import type { QueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { httpClient } from '@/infrastructure/http/client';

/** Mismas formas que Salud ocupacional / Sistemas; solo cambia el prefijo API. */
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

const BASE = 'horas-extra/module-settings';

export type WfBoletaExportPublic = {
  module_slug: string;
  protocol: 'sftp' | 'smb';
  host: string;
  port: number;
  remote_path: string;
  share_name: string | null;
  username: string | null;
  password_configured: boolean;
};

export type WfBoletaExportPatch = {
  protocol: 'sftp' | 'smb';
  host: string;
  port: number;
  remote_path: string;
  share_name?: string | null;
  username?: string | null;
  password?: string;
};

export type WfOrgSubdivision = {
  division_code: string;
  subdivision_code: string;
  name: string | null;
};

export type WfOrgGroup = {
  slug: string;
  label: string;
  division_codes: string[];
  subdivisions: WfOrgSubdivision[];
};

export async function wfFetchOrgCatalog(): Promise<{ groups: WfOrgGroup[] }> {
  return httpClient.get(`${BASE}/org-catalog`).json<{ groups: WfOrgGroup[] }>();
}

export type WfAssigneeRow = {
  division_code: string;
  subdivision_code: string;
  role: 'supervisor' | 'approver';
  worker_id: string;
  worker_name: string | null;
};

export async function wfFetchSubdivisionAssignments(): Promise<{ items: WfAssigneeRow[] }> {
  return httpClient.get(`${BASE}/subdivision-assignments`).json<{ items: WfAssigneeRow[] }>();
}

export async function wfPatchSubdivisionAssignments(body: {
  division_code: string;
  subdivision_code: string;
  supervisor_worker_ids: string[];
  approver_worker_ids: string[];
}): Promise<{ ok: true }> {
  return httpClient.patch(`${BASE}/subdivision-assignments`, { json: body }).json<{ ok: true }>();
}

export async function wfFetchWorkerLookup(q: string): Promise<{
  suggestions: { sap_code: string; name: string }[];
}> {
  const query = q.trim();
  if (query.length < 2) {
    return { suggestions: [] };
  }
  const sp = new URLSearchParams({ q: query });
  return httpClient.get(`${BASE}/worker-lookup?${sp}`).json<{
    suggestions: { sap_code: string; name: string }[];
  }>();
}

export async function wfFetchBoletaExportSettings(): Promise<WfBoletaExportPublic | null> {
  return httpClient.get(`${BASE}/boleta-export-settings`).json<WfBoletaExportPublic | null>();
}

export async function wfPatchBoletaExportSettings(body: WfBoletaExportPatch) {
  return httpClient
    .patch(`${BASE}/boleta-export-settings`, { json: body })
    .json<WfBoletaExportPublic>();
}

export async function wfPostBoletaExportTest(): Promise<
  { ok: true; ms: number } | { ok: false; message: string }
> {
  return httpClient.post(`${BASE}/boleta-export-settings/test`, { json: {} }).json<
    { ok: true; ms: number } | { ok: false; message: string }
  >();
}

export async function wfFetchModuleRbacCatalog(): Promise<SoModuleRbacCatalog> {
  return httpClient.get(`${BASE}/rbac-catalog`).json<SoModuleRbacCatalog>();
}

export async function wfFetchProfileActionCatalog() {
  return httpClient
    .get(`${BASE}/profile-action-catalog`)
    .json<{ apps: SoProfileActionCatalogApp[] }>();
}

export async function wfFetchWorkerAssignmentsInModule(workerId: string) {
  const id = workerId.trim();
  return httpClient
    .get(`${BASE}/workers/${encodeURIComponent(id)}/assignments`)
    .json<{ worker_id: string; assignments: SoModuleAssignment[] }>();
}

export async function wfFetchModuleMembers(params?: {
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

export async function wfFetchModuleProfiles() {
  return httpClient.get(`${BASE}/module-profiles`).json<{ profiles: SoModuleProfileRow[] }>();
}

export async function wfFetchModuleProfileDetail(profileId: string) {
  return httpClient
    .get(`${BASE}/module-profiles/${encodeURIComponent(profileId)}`)
    .json<SoModuleProfileDetail>();
}

export async function wfCreateModuleProfile(body: {
  label: string;
  description?: string | null;
  slug?: string | null;
  app_permissions: { app_slug: string; actions: string[] }[];
}) {
  return httpClient
    .post(`${BASE}/module-profiles`, { json: body })
    .json<{ id: string; slug: string; label: string; description: string | null; role_count: number }>();
}

export async function wfUpdateModuleProfile(
  profileId: string,
  body: {
    label?: string;
    description?: string | null;
    app_permissions?: { app_slug: string; actions: string[] }[];
  },
) {
  return httpClient
    .patch(`${BASE}/module-profiles/${encodeURIComponent(profileId)}`, { json: body })
    .json<{ ok: true; id: string; note?: string }>();
}

export async function wfDeleteModuleProfile(profileId: string) {
  return httpClient
    .delete(`${BASE}/module-profiles/${encodeURIComponent(profileId)}`)
    .json<{ deleted: true; id: string }>();
}

export async function wfFetchPermissionMatrix() {
  return httpClient.get(`${BASE}/permission-matrix`).json<{ matrix: SoMatrixCell[] }>();
}

export async function wfApplyModuleProfile(body: { worker_id: string; profile_slug: string }) {
  return httpClient
    .post(`${BASE}/apply-profile`, { json: body })
    .json<{ applied: number; skipped_duplicates: number }>();
}

export async function wfAssignWorkerRoleInModule(body: { worker_id: string; role_id: string }) {
  return httpClient
    .post(`${BASE}/worker-assignments`, { json: body })
    .json<{ id: string; worker_id: string; role_id: string }>();
}

export async function wfRevokeAssignmentInModule(assignmentId: string) {
  return httpClient
    .delete(`${BASE}/assignments/${assignmentId}`)
    .json<{ revoked: true; assignment_id: string }>();
}

export async function wfFetchMemberDetail(workerId: string) {
  const id = workerId.trim();
  return httpClient
    .get(`${BASE}/members/${encodeURIComponent(id)}`)
    .json<SoMemberDetail>();
}

export async function wfRevokeAllInModule(workerId: string) {
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

export async function wfReplaceMemberProfile(workerId: string, profile_slug: string) {
  const id = workerId.trim();
  return httpClient
    .post(`${BASE}/members/${encodeURIComponent(id)}/profile`, { json: { profile_slug } })
    .json<{ applied: number; skipped_duplicates: number }>();
}

export async function wfFetchModuleEmailSettings() {
  return httpClient.get(`${BASE}/email-settings`).json<SoModuleEmailSettings | null>();
}

export async function wfPatchModuleEmailSettings(body: SoModuleEmailSettingsPatch) {
  return httpClient.patch(`${BASE}/email-settings`, { json: body }).json<SoModuleEmailSettings>();
}

export async function wfPostModuleEmailTest(to: string) {
  return httpClient
    .post(`${BASE}/email-settings/test`, { json: { to: to.trim() } })
    .json<{ sent: true }>();
}

export async function invalidateWfModuleSettingsRelatedQueries(qc: QueryClient) {
  await qc.invalidateQueries({ queryKey: ['workforce', 'module-settings', 'members'] });
  await qc.invalidateQueries({ queryKey: ['workforce', 'module-settings', 'module-profiles'] });
  await qc.invalidateQueries({ queryKey: ['workforce', 'module-settings', 'profile-action-catalog'] });
  await qc.invalidateQueries({ queryKey: ['workforce', 'module-settings', 'email-settings'] });
  await qc.invalidateQueries({ queryKey: ['workforce', 'module-settings', 'boleta-export-settings'] });
  await qc.invalidateQueries({ queryKey: ['admin', 'rbac', 'modules-summary'] });
}

export async function invalidateWfMemberDetailAndRelated(qc: QueryClient, workerId: string | null) {
  await invalidateWfModuleSettingsRelatedQueries(qc);
  if (workerId) {
    await qc.invalidateQueries({
      queryKey: ['workforce', 'module-settings', 'member-detail', workerId],
    });
  }
}

export async function readWfModuleSettingsMessage(e: unknown): Promise<string | undefined> {
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
