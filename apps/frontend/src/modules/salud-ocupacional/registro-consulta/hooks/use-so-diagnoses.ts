import { useQuery } from '@tanstack/react-query';
import { soFetchDiagnoses } from '../repository/so-consultations.api-repository';

export function useSoDiagnoses() {
  return useQuery({
    queryKey: ['so', 'registro', 'diagnoses'],
    queryFn: soFetchDiagnoses,
    staleTime: 5 * 60_000,
  });
}
