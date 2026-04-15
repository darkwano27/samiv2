import { httpClient } from '@/infrastructure/http/client';

const BASE = 'salud-ocupacional/reports';

export type SoReportQueryParams = {
  from: string;
  to: string;
  division?: string;
  subdivision?: string;
};

function toSearchParams(p: SoReportQueryParams): Record<string, string> {
  const o: Record<string, string> = {
    from: p.from,
    to: p.to,
  };
  if (p.division?.trim()) o.division = p.division.trim();
  if (p.subdivision?.trim()) o.subdivision = p.subdivision.trim();
  return o;
}

export const soReportsApi = {
  summary: (p: SoReportQueryParams) =>
    httpClient.get(`${BASE}/summary`, { searchParams: toSearchParams(p) }).json(),

  dischargeConditions: (p: SoReportQueryParams) =>
    httpClient
      .get(`${BASE}/discharge-conditions`, { searchParams: toSearchParams(p) })
      .json(),

  topDiagnoses: (p: SoReportQueryParams & { limit?: number }) =>
    httpClient
      .get(`${BASE}/top-diagnoses`, {
        searchParams: { ...toSearchParams(p), ...(p.limit ? { limit: String(p.limit) } : {}) },
      })
      .json(),

  byDivision: (p: SoReportQueryParams) =>
    httpClient.get(`${BASE}/by-division`, { searchParams: toSearchParams(p) }).json(),

  subdivisions: (p: SoReportQueryParams) =>
    httpClient
      .get(`${BASE}/subdivisions`, { searchParams: toSearchParams(p) })
      .json() as Promise<{ subdivisions: string[] }>,

  topMedications: (p: SoReportQueryParams & { limit?: number }) =>
    httpClient
      .get(`${BASE}/top-medications`, {
        searchParams: { ...toSearchParams(p), ...(p.limit ? { limit: String(p.limit) } : {}) },
      })
      .json(),

  topPatients: (p: SoReportQueryParams & { limit?: number }) =>
    httpClient
      .get(`${BASE}/top-patients`, {
        searchParams: { ...toSearchParams(p), ...(p.limit ? { limit: String(p.limit) } : {}) },
      })
      .json(),

  trend: (p: SoReportQueryParams & { weeks?: number }) =>
    httpClient
      .get(`${BASE}/trend`, {
        searchParams: {
          ...toSearchParams(p),
          ...(p.weeks != null ? { weeks: String(p.weeks) } : {}),
        },
      })
      .json(),

  downloadPdf: async (p: SoReportQueryParams): Promise<Blob> =>
    httpClient.get(`${BASE}/export.pdf`, { searchParams: toSearchParams(p) }).blob(),
};
