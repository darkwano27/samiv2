import { useMutation } from '@tanstack/react-query';
import { authRepository } from '../repository/auth.api-repository';

export function useIdentify() {
  return useMutation({
    mutationFn: (sapCode: string) => authRepository.identify(sapCode),
  });
}
