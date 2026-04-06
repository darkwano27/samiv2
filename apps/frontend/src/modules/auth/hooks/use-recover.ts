import { useMutation } from '@tanstack/react-query';
import { authRepository } from '../repository/auth.api-repository';

export function useRecover() {
  return useMutation({
    mutationFn: ({ sapCode, dni }: { sapCode: string; dni: string }) =>
      authRepository.recover(sapCode, dni),
  });
}
