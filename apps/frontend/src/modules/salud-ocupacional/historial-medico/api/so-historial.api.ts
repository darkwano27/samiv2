import { httpClient } from '@/infrastructure/http/client';
import type { SoHistorialResponse } from '../types/so-historial.types';

const BASE = 'salud-ocupacional/consultations';

export type HistorialFilterMeta = {
  divisions: string[];
  subdivisions: string[];
};

export async function soFetchHistorialFilters(): Promise<HistorialFilterMeta> {
  return httpClient.get(`${BASE}/historial/filters`).json<HistorialFilterMeta>();
}

export type HistorialListParams = {
  page: number;
  limit: number;
  search?: string;
  division?: string;
  subdivision?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function soFetchHistorial(
  params: HistorialListParams,
): Promise<SoHistorialResponse> {
  return httpClient
    .get(`${BASE}/historial`, {
      searchParams: {
        page: params.page,
        limit: params.limit,
        ...(params.search ? { search: params.search } : {}),
        ...(params.division ? { division: params.division } : {}),
        ...(params.subdivision ? { subdivision: params.subdivision } : {}),
        ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
        ...(params.dateTo ? { dateTo: params.dateTo } : {}),
      },
    })
    .json<SoHistorialResponse>();
}

export function buildHistorialCsvDownloadUrl(filters: {
  search?: string;
  division?: string;
  subdivision?: string;
  dateFrom?: string;
  dateTo?: string;
}): string {
  const p = new URLSearchParams();
  p.set('page', '1');
  p.set('limit', '20');
  if (filters.search) p.set('search', filters.search);
  if (filters.division) p.set('division', filters.division);
  if (filters.subdivision) p.set('subdivision', filters.subdivision);
  if (filters.dateFrom) p.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) p.set('dateTo', filters.dateTo);
  return `/api/${BASE}/historial/export-csv?${p.toString()}`;
}
