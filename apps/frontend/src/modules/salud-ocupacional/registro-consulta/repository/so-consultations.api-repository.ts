import { HTTPError } from 'ky';
import { httpClient } from '@/infrastructure/http/client';
import type {
  CreateConsultationPayload,
  SoDiagnosis,
  SoMedicine,
  SoSapWorker,
} from '../types/so-consultation.types';
import type {
  SoMedicineAdminRoute,
  SoMedicineInventoryUnit,
  SoMedicinePresentation,
} from '../types/so-medicine-form.constants';

const BASE = 'salud-ocupacional/consultations';

export async function soSapSearch(q: string): Promise<SoSapWorker[]> {
  const query = q.trim();
  if (query.length < 1) return [];
  return httpClient
    .get(`${BASE}/sap-search`, { searchParams: { q: query } })
    .json<SoSapWorker[]>();
}

export async function soFetchDiagnoses(): Promise<SoDiagnosis[]> {
  return httpClient.get(`${BASE}/diagnoses`).json<SoDiagnosis[]>();
}

export async function soCreateDiagnosis(body: {
  name: string;
  code?: string;
}): Promise<SoDiagnosis> {
  return httpClient.post(`${BASE}/diagnoses`, { json: body }).json<SoDiagnosis>();
}

export async function soFetchMedicines(): Promise<SoMedicine[]> {
  return httpClient.get(`${BASE}/medicines`).json<SoMedicine[]>();
}

export async function soSearchMedicines(q: string): Promise<SoMedicine[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  return httpClient
    .get(`${BASE}/medicines/search`, { searchParams: { q: query } })
    .json<SoMedicine[]>();
}

export async function soCreateMedicine(body: {
  name: string;
  presentation: SoMedicinePresentation;
  concentration: string;
  administrationRoute: SoMedicineAdminRoute;
  inventoryUnit: SoMedicineInventoryUnit;
}): Promise<SoMedicine> {
  return httpClient.post(`${BASE}/medicines`, { json: body }).json<SoMedicine>();
}

export async function soCreateConsultation(
  body: CreateConsultationPayload,
): Promise<{ id: string; correlative: number; success: true }> {
  return httpClient
    .post(BASE, { json: body })
    .json<{ id: string; correlative: number; success: true }>();
}

export async function readApiMessage(e: unknown): Promise<string | undefined> {
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
