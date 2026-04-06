import type { QueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { httpClient } from '@/infrastructure/http/client';

const BASE = 'salud-ocupacional/module-settings';

export type SoModuleRbacApp = {
  id: string;
  slug: string;
  module_slug: string;
  label: string;
  is_management: boolean;
};

export type SoModuleRbacRole = {
  id: string;
  app_id: string;
  slug: string;
  label: string;
  level: number;
};

export type SoModuleRbacFeature = {
  id: string;
  app_id: string;
  slug: string;
  label: string;
};

export type SoModuleRbacCatalog = {
  apps: SoModuleRbacApp[];
  roles: SoModuleRbacRole[];
  features: SoModuleRbacFeature[];
};

export type SoModuleAssignment = {
  id: string;
  worker_id: string;
  role_id: string;
  created_at: string | null;
  expires_at: string | null;
  role_slug: string;
  app_slug: string;
  module_slug: string;
};

export type SoModuleMember = {
  worker_id: string;
  /** Nombre en `workers`; null si solo existe el stub SAP. */
  display_name?: string | null;
  app_count: number;
  assignments: {
    app_slug: string;
    role_slug: string;
    assignment_id: string;
  }[];
  /** Perfil plantilla registrado al aplicar el perfil (no inferido por roles). */
  applied_profile_slug?: string | null;
  applied_profile_label?: string | null;
  /** Pista de UI cuando hay varios `applied_profile_id` o ninguno (p. ej. admin de módulo). */
  primary?: string | null;
};

/** Conteo por slug de perfil (incluye perfiles custom). */
export type SoModuleProfileCounts = Record<string, number>;

export type SoModuleMembersPage = {
  members: SoModuleMember[];
  total: number;
  page: number;
  limit: number;
  profile_counts: SoModuleProfileCounts;
};

export type SoModuleProfileRow = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  role_count: number;
  member_count: number;
  is_seed: boolean;
  unique_apps_count: number;
  permission_matrix_cells: number;
};

export type SoModuleProfileDetail = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  is_seed: boolean;
  member_count: number;
  role_count: number;
  unique_apps_count: number;
  permission_matrix_cells: number;
  roles: {
    role_id: string;
    app_slug: string;
    app_label: string;
    app_is_management: boolean;
    role_slug: string;
    role_label: string;
  }[];
  /** Acciones por app (para el modal; el backend resolvió el rol internamente). */
  app_permissions: { app_slug: string; actions: string[] }[];
};

export type SoProfileActionCatalogApp = {
  slug: string;
  label: string;
  is_management: boolean;
  available_actions: string[];
  management_note?: string;
  /** Alcance de acciones de producto para esta app (p. ej. solo lectura y creación). */
  action_scope_note?: string;
};

export type SoMatrixCell = {
  app_slug: string;
  app_label: string;
  role_slug: string;
  role_label: string;
  feature_slug: string;
  feature_label: string;
  actions: string[];
};

export async function soFetchModuleRbacCatalog(): Promise<SoModuleRbacCatalog> {
  return httpClient.get(`${BASE}/rbac-catalog`).json<SoModuleRbacCatalog>();
}

export async function soFetchProfileActionCatalog() {
  return httpClient
    .get(`${BASE}/profile-action-catalog`)
    .json<{ apps: SoProfileActionCatalogApp[] }>();
}

export async function soFetchWorkerLookup(q: string) {
  const sp = new URLSearchParams();
  if (q.trim()) sp.set('q', q.trim());
  const qs = sp.toString();
  return httpClient
    .get(qs ? `${BASE}/worker-lookup?${qs}` : `${BASE}/worker-lookup`)
    .json<{ suggestions: { sap_code: string; name: string }[] }>();
}

export async function soFetchWorkerAssignmentsInModule(workerId: string) {
  const id = workerId.trim();
  return httpClient
    .get(`${BASE}/workers/${encodeURIComponent(id)}/assignments`)
    .json<{ worker_id: string; assignments: SoModuleAssignment[] }>();
}

export async function soFetchModuleMembers(params?: {
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

export async function soFetchModuleProfiles() {
  return httpClient
    .get(`${BASE}/module-profiles`)
    .json<{ profiles: SoModuleProfileRow[] }>();
}

export async function soFetchModuleProfileDetail(profileId: string) {
  return httpClient
    .get(`${BASE}/module-profiles/${encodeURIComponent(profileId)}`)
    .json<SoModuleProfileDetail>();
}

export async function soCreateModuleProfile(body: {
  label: string;
  description?: string | null;
  slug?: string | null;
  app_permissions: { app_slug: string; actions: string[] }[];
}) {
  return httpClient
    .post(`${BASE}/module-profiles`, { json: body })
    .json<{ id: string; slug: string; label: string; description: string | null; role_count: number }>();
}

export async function soUpdateModuleProfile(
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

export async function soDeleteModuleProfile(profileId: string) {
  return httpClient
    .delete(`${BASE}/module-profiles/${encodeURIComponent(profileId)}`)
    .json<{ deleted: true; id: string }>();
}

export async function soFetchPermissionMatrix() {
  return httpClient
    .get(`${BASE}/permission-matrix`)
    .json<{ matrix: SoMatrixCell[] }>();
}

export async function soApplySoProfile(body: {
  worker_id: string;
  profile_slug: string;
}) {
  return httpClient
    .post(`${BASE}/apply-profile`, { json: body })
    .json<{ applied: number; skipped_duplicates: number }>();
}

export async function soAssignWorkerRoleInModule(body: {
  worker_id: string;
  role_id: string;
}) {
  return httpClient
    .post(`${BASE}/worker-assignments`, { json: body })
    .json<{ id: string; worker_id: string; role_id: string }>();
}

export async function soRevokeAssignmentInModule(assignmentId: string) {
  return httpClient
    .delete(`${BASE}/assignments/${assignmentId}`)
    .json<{ revoked: true; assignment_id: string }>();
}

export type SoMemberAppAccess = {
  assignment_id: string;
  app_slug: string;
  app_label: string;
  role_slug: string;
  role_label: string;
  features: { feature_slug: string; actions: string[] }[];
  /** Si hay perfil aplicado con `app_permissions_json`, acciones de producto a mostrar (no la unión del rol). */
  profile_product_actions?: string[];
};

export type SoMemberAppNoAccess = {
  app_slug: string;
  app_label: string;
  reason: 'sin_acceso' | 'solo_admin';
};

export type SoMemberDetail = {
  worker_id: string;
  display_name: string;
  assigned_at: string | null;
  /** Perfil plantilla vigente (si las asignaciones lo registraron). */
  applied_profile?: { slug: string; label: string } | null;
  apps_with_access: SoMemberAppAccess[];
  apps_without_access: SoMemberAppNoAccess[];
};

export async function soFetchMemberDetail(workerId: string) {
  const id = workerId.trim();
  return httpClient
    .get(`${BASE}/members/${encodeURIComponent(id)}`)
    .json<SoMemberDetail>();
}

export async function soRevokeAllInModule(workerId: string) {
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

export async function soReplaceMemberProfile(
  workerId: string,
  profile_slug: string,
) {
  const id = workerId.trim();
  return httpClient
    .post(`${BASE}/members/${encodeURIComponent(id)}/profile`, {
      json: { profile_slug },
    })
    .json<{ applied: number; skipped_duplicates: number }>();
}

export type SoModuleEmailSettings = {
  module_slug: string;
  smtp_host: string;
  smtp_port: number;
  mail_secure: boolean;
  smtp_user: string | null;
  smtp_from: string;
  smtp_pass_configured: boolean;
};

export type SoModuleEmailSettingsPatch = {
  smtp_host: string;
  smtp_port: number;
  mail_secure: boolean;
  smtp_user: string;
  smtp_from: string;
  /** Solo al crear o cambiar; omitir para dejar la guardada. */
  smtp_pass?: string;
};

export async function soFetchModuleEmailSettings() {
  return httpClient
    .get(`${BASE}/email-settings`)
    .json<SoModuleEmailSettings | null>();
}

export async function soPatchModuleEmailSettings(body: SoModuleEmailSettingsPatch) {
  return httpClient
    .patch(`${BASE}/email-settings`, { json: body })
    .json<SoModuleEmailSettings>();
}

export async function soPostModuleEmailTest(to: string) {
  return httpClient
    .post(`${BASE}/email-settings/test`, { json: { to: to.trim() } })
    .json<{ sent: true }>();
}

/** Invalidación cruzada tras mutaciones en Ajustes SO (lista miembros, perfiles, resumen admin). */
export async function invalidateSoModuleSettingsRelatedQueries(qc: QueryClient) {
  await qc.invalidateQueries({ queryKey: ['so', 'module-settings', 'members'] });
  await qc.invalidateQueries({ queryKey: ['so', 'module-settings', 'module-profiles'] });
  await qc.invalidateQueries({ queryKey: ['so', 'module-settings', 'profile-action-catalog'] });
  await qc.invalidateQueries({ queryKey: ['so', 'module-settings', 'email-settings'] });
  await qc.invalidateQueries({ queryKey: ['admin', 'rbac', 'modules-summary'] });
}

export async function invalidateSoMemberDetailAndRelated(
  qc: QueryClient,
  workerId: string | null,
) {
  await invalidateSoModuleSettingsRelatedQueries(qc);
  if (workerId) {
    await qc.invalidateQueries({
      queryKey: ['so', 'module-settings', 'member-detail', workerId],
    });
  }
}

export async function readSoModuleSettingsMessage(e: unknown): Promise<string | undefined> {
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
