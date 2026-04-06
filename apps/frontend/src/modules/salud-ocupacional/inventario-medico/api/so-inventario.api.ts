import { httpClient } from '@/infrastructure/http/client';
import type {
  SoMedicineAdminRoute,
  SoMedicineInventoryUnit,
  SoMedicinePresentation,
} from '@/modules/salud-ocupacional/registro-consulta/types/so-medicine-form.constants';

const BASE = 'salud-ocupacional/consultations/inventario';

export type SoInventarioDiagnosis = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  createdAt: string;
};

export type SoInventarioMedicine = {
  id: string;
  name: string;
  presentation: string;
  concentration: string;
  administrationRoute: string;
  inventoryUnit: string;
  isActive: boolean;
  createdAt: string;
};

export async function soInventarioFetchDiagnoses(): Promise<SoInventarioDiagnosis[]> {
  return httpClient.get(`${BASE}/diagnoses`).json<SoInventarioDiagnosis[]>();
}

export async function soInventarioFetchMedicines(): Promise<SoInventarioMedicine[]> {
  return httpClient.get(`${BASE}/medicines`).json<SoInventarioMedicine[]>();
}

export async function soInventarioCreateDiagnosis(body: {
  name: string;
  code?: string;
}): Promise<SoInventarioDiagnosis> {
  return httpClient.post(`${BASE}/diagnoses`, { json: body }).json<SoInventarioDiagnosis>();
}

export async function soInventarioCreateMedicine(body: {
  name: string;
  presentation: SoMedicinePresentation;
  concentration: string;
  administrationRoute: SoMedicineAdminRoute;
  inventoryUnit: SoMedicineInventoryUnit;
}): Promise<SoInventarioMedicine> {
  return httpClient.post(`${BASE}/medicines`, { json: body }).json<SoInventarioMedicine>();
}

export async function soInventarioPatchDiagnosis(
  id: string,
  body: {
    name?: string;
    code?: string | null;
    isActive?: boolean;
  },
): Promise<SoInventarioDiagnosis> {
  return httpClient
    .patch(`${BASE}/diagnoses/${id}`, { json: body })
    .json<SoInventarioDiagnosis>();
}

export async function soInventarioPatchMedicine(
  id: string,
  body: {
    name?: string;
    presentation?: SoMedicinePresentation;
    concentration?: string;
    administrationRoute?: SoMedicineAdminRoute;
    inventoryUnit?: SoMedicineInventoryUnit;
    isActive?: boolean;
  },
): Promise<SoInventarioMedicine> {
  return httpClient
    .patch(`${BASE}/medicines/${id}`, { json: body })
    .json<SoInventarioMedicine>();
}
