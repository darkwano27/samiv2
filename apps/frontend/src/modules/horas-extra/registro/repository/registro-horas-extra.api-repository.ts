import { httpClient } from '@/infrastructure/http/client';

const BASE = 'horas-extra/registro';

export type HeSupervisorScopeGroup = {
  slug: string;
  label: string;
  division_codes: string[];
  subdivisions: {
    division_code: string;
    subdivision_code: string;
    name: string | null;
  }[];
};

export type HeSupervisorScopeResponse = {
  groups: HeSupervisorScopeGroup[];
  message: string | null;
  full_org_access: boolean;
};

export type HeMotivo = { code: string; label: string };

export type HeWorkerSearchHit = { sap_code: string; name: string };

export async function heFetchSupervisorScope(): Promise<HeSupervisorScopeResponse> {
  return httpClient.get(`${BASE}/supervisor-scope`).json<HeSupervisorScopeResponse>();
}

export async function heFetchMotivos(): Promise<{ items: HeMotivo[] }> {
  return httpClient.get(`${BASE}/motivos`).json<{ items: HeMotivo[] }>();
}

export async function heSearchWorkers(params: {
  q: string;
  division_code: string;
  subdivision_codes: string[];
}): Promise<{ results: HeWorkerSearchHit[] }> {
  const sp = new URLSearchParams();
  sp.set('q', params.q);
  sp.set('division_code', params.division_code);
  if (params.subdivision_codes.length) {
    sp.set('subdivision_codes', params.subdivision_codes.join(','));
  }
  return httpClient.get(`${BASE}/workers-search?${sp.toString()}`).json<{
    results: HeWorkerSearchHit[];
  }>();
}

export type HeBoletaLinePayload = {
  pernr: string;
  worker_name?: string | null;
  valid_from: string;
  valid_to: string;
  days: number;
  time_start: string;
  time_end: string;
  motivo_code?: string | null;
  observaciones?: string | null;
};

export type HeCreateBoletaPayload = {
  group_slug: string;
  division_code: string;
  subdivision_pairs: { division_code: string; subdivision_code: string }[];
  valid_from: string;
  valid_to: string;
  /** Si no se envía, el servidor usa 08:00–18:00 en la cabecera. */
  time_start?: string;
  time_end?: string;
  motivo_code?: string | null;
  lines: HeBoletaLinePayload[];
};

export async function heCreateBoleta(
  body: HeCreateBoletaPayload,
): Promise<{ id: string; display_number: number; ok: true }> {
  return httpClient
    .post(`${BASE}/boletas`, { json: body })
    .json<{ id: string; display_number: number; ok: true }>();
}

export type HeBoletaDetailLine = {
  id: string;
  pernr: string;
  worker_name: string | null;
  valid_from: string;
  valid_to: string;
  days: number;
  time_start: string;
  time_end: string;
  motivo_code: string | null;
  observaciones: string | null;
};

export type HeBoletaDetailResponse = {
  header: {
    id: string;
    display_number: number;
    group_slug: string;
    division_code: string;
    subdivision_pairs: { division_code: string; subdivision_code: string }[];
    subdivision_label: string;
    valid_from: string;
    valid_to: string;
    time_start: string;
    time_end: string;
    motivo_code: string | null;
    status: string;
    created_by: string;
    created_by_name: string | null;
    created_at: string;
    approved_by: string | null;
    approved_by_name: string | null;
    approved_at: string | null;
  };
  lines: HeBoletaDetailLine[];
};

export async function heFetchBoletaDetail(headerId: string): Promise<HeBoletaDetailResponse> {
  return httpClient.get(`${BASE}/boletas/${headerId}`).json<HeBoletaDetailResponse>();
}

export async function heUpdateBoleta(
  headerId: string,
  body: HeCreateBoletaPayload,
): Promise<{ ok: true }> {
  return httpClient.patch(`${BASE}/boletas/${headerId}`, { json: body }).json<{ ok: true }>();
}
