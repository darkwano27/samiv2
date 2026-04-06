import { useQuery } from '@tanstack/react-query';
import { soSearchMedicines } from '../repository/so-consultations.api-repository';
import { useDebouncedValue } from './use-debounce';

export function useSoMedicineSearch(search: string) {
  const q = useDebouncedValue(search.trim(), 300);
  return useQuery({
    queryKey: ['so', 'registro', 'medicines-search', q],
    queryFn: () => soSearchMedicines(q),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}
