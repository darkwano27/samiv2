import { useMutation } from '@tanstack/react-query';
import { authRepository } from '../repository/auth.api-repository';

export function useAuthLogin() {
  return useMutation({
    mutationFn: ({ sapCode, password }: { sapCode: string; password: string }) =>
      authRepository.login(sapCode, password),
  });
}
