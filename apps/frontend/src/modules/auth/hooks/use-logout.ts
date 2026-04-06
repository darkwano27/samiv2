/**
 * Cierra sesión en backend, vacía **todas** las queries (`queryClient.clear()`) y navega a `/login`.
 * Pensado para el botón **Salir** del shell autenticado (`AuthenticatedAppHeader`).
 * `onSettled` asegura limpieza también si el POST de logout falla en red.
 */

import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { queryClient } from '@/infrastructure/query/query-client';
import { authRepository } from '@/modules/auth/repository/auth.api-repository';

export function useLogout() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => authRepository.logout(),
    onSettled: () => {
      void queryClient.clear();
      void navigate({ to: '/login' });
    },
  });
}
