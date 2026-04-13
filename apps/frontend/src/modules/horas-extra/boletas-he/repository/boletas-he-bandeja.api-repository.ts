import { httpClient } from '@/infrastructure/http/client';
import type { HeBoletaDetailResponse } from '@/modules/horas-extra/registro/repository/registro-horas-extra.api-repository';

export type HeBandejaHeaderRow = {
  header_id: string;
  display_number: number;
  subdivision_codes: string[];
  subdivision_label: string;
  valid_from: string;
  valid_to: string;
  line_count: number;
  total_hours: number;
  motivo_code: string | null;
  status: string;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
};

export type HeBandejaHeadersPage = {
  items: HeBandejaHeaderRow[];
  total: number;
  page: number;
  page_size: number;
};

const URLS = {
  registro: 'horas-extra/registro/boletas-bandeja',
  aprobacion: 'horas-extra/aprobacion/bandeja',
} as const;

const SUBDIVISION_CATALOG_URLS = {
  aprobacion: 'horas-extra/aprobacion/bandeja-subdivisiones',
} as const;

export type BandejaApiMode = keyof typeof URLS;

export type HeBandejaSubdivisionOption = {
  division_code: string;
  subdivision_code: string;
  name: string;
};

export async function heFetchBandejaSubdivisionCatalog(): Promise<{ items: HeBandejaSubdivisionOption[] }> {
  return httpClient.get(SUBDIVISION_CATALOG_URLS.aprobacion).json<{ items: HeBandejaSubdivisionOption[] }>();
}

export async function heFetchBandejaHeaders(
  mode: BandejaApiMode,
  params: {
    date_from: string;
    date_to: string;
    page: number;
    page_size?: number;
    worker_q?: string;
    boleta_q?: string;
    creator_q?: string;
    subdivision_codes?: string[];
    status?: string[];
  },
): Promise<HeBandejaHeadersPage> {
  const sp = new URLSearchParams();
  sp.set('date_from', params.date_from);
  sp.set('date_to', params.date_to);
  sp.set('page', String(params.page));
  sp.set('page_size', String(params.page_size ?? 20));
  if (params.worker_q?.trim()) sp.set('worker_q', params.worker_q.trim());
  if (params.boleta_q?.trim()) sp.set('boleta_q', params.boleta_q.trim());
  if (params.creator_q?.trim()) sp.set('creator_q', params.creator_q.trim());
  if (params.subdivision_codes?.length) sp.set('subdivision_codes', params.subdivision_codes.join(','));
  if (params.status?.length) sp.set('status', params.status.join(','));
  return httpClient.get(`${URLS[mode]}?${sp.toString()}`).json<HeBandejaHeadersPage>();
}

function boletaPath(mode: BandejaApiMode, headerId: string): string {
  return mode === 'registro'
    ? `horas-extra/registro/boletas/${headerId}`
    : `horas-extra/aprobacion/boletas/${headerId}`;
}

export async function heFetchBoletaDetailForBandeja(
  mode: BandejaApiMode,
  headerId: string,
): Promise<HeBoletaDetailResponse> {
  return httpClient.get(boletaPath(mode, headerId)).json<HeBoletaDetailResponse>();
}

export async function heAnularBoletaBandeja(mode: BandejaApiMode, headerId: string): Promise<{ ok: true }> {
  return httpClient.delete(boletaPath(mode, headerId)).json<{ ok: true }>();
}

export async function heAprobarBoletaBandeja(headerId: string): Promise<{ ok: true }> {
  return httpClient.post(`horas-extra/aprobacion/boletas/${headerId}/aprobar`).json<{ ok: true }>();
}

function boletaPdfPath(mode: BandejaApiMode, headerId: string): string {
  return mode === 'registro'
    ? `horas-extra/registro/boletas/${headerId}/pdf`
    : `horas-extra/aprobacion/boletas/${headerId}/pdf`;
}

/** Descarga el PDF de una boleta ya aprobada (firma del aprobador). */
export async function heDownloadApprovedBoletaPdf(mode: BandejaApiMode, headerId: string): Promise<void> {
  const res = await httpClient.get(boletaPdfPath(mode, headerId));
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition');
  let filename = 'boleta_he.pdf';
  const m = /filename="([^"]+)"/i.exec(cd ?? '') ?? /filename=([^;\s]+)/i.exec(cd ?? '');
  if (m?.[1]) filename = m[1].trim();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
