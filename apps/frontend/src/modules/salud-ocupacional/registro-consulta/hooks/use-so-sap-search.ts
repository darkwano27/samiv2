import { useQuery } from '@tanstack/react-query';
import { soSapSearch } from '../repository/so-consultations.api-repository';
import { useDebouncedValue } from './use-debounce';

export function useSoSapSearch(search: string) {
  const q = useDebouncedValue(search.trim(), 300);
  return useQuery({
    queryKey: ['so', 'registro', 'sap-search', q],
    queryFn: () => soSapSearch(q),
    enabled: q.length >= 1,
    staleTime: 30_000,
  });
}
