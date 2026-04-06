import { useMutation } from '@tanstack/react-query';
import { authRepository } from '../repository/auth.api-repository';

export function useRegister() {
  return useMutation({
    mutationFn: ({ sapCode, dni }: { sapCode: string; dni: string }) =>
      authRepository.register(sapCode, dni),
  });
}
