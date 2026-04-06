import { useMutation } from '@tanstack/react-query';
import { authRepository } from '../repository/auth.api-repository';

export function useChangePassword(tempToken: string) {
  return useMutation({
    mutationFn: ({
      newPassword,
      confirmPassword,
    }: {
      newPassword: string;
      confirmPassword: string;
    }) =>
      authRepository.changePassword(tempToken, newPassword, confirmPassword),
  });
}
