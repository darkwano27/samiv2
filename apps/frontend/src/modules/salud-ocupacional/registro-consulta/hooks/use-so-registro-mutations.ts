import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  soCreateConsultation,
  soCreateDiagnosis,
  soCreateMedicine,
} from '../repository/so-consultations.api-repository';
import type { CreateConsultationPayload } from '../types/so-consultation.types';
import type {
  SoMedicineAdminRoute,
  SoMedicineInventoryUnit,
  SoMedicinePresentation,
} from '../types/so-medicine-form.constants';

export function useSoCreateDiagnosis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; code?: string }) => soCreateDiagnosis(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['so', 'registro', 'diagnoses'] });
    },
  });
}

export function useSoCreateMedicine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      presentation: SoMedicinePresentation;
      concentration: string;
      administrationRoute: SoMedicineAdminRoute;
      inventoryUnit: SoMedicineInventoryUnit;
    }) => soCreateMedicine(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['so', 'registro'] });
    },
  });
}

export function useSoCreateConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateConsultationPayload) => soCreateConsultation(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['so'] });
    },
  });
}
