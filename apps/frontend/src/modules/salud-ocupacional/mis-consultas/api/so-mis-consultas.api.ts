import { httpClient } from '@/infrastructure/http/client';

const BASE = 'salud-ocupacional/consultations/my';

export type SoMyConsultationRow = {
  id: string;
  correlative: number;
  patientCod: string;
  patientName: string;
  attentionDate: string;
  reason: string | null;
  dischargeCondition: string;
  createdAt: string;
};

export type SoMyConsultationsResponse = {
  data: SoMyConsultationRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function soFetchMyConsultations(params: {
  page: number;
  limit: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<SoMyConsultationsResponse> {
  return httpClient
    .get(BASE, {
      searchParams: {
        page: params.page,
        limit: params.limit,
        ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
        ...(params.dateTo ? { dateTo: params.dateTo } : {}),
      },
    })
    .json<SoMyConsultationsResponse>();
}
