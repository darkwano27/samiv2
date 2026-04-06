import { createFileRoute, redirect, isRedirect } from '@tanstack/react-router';
import { authRepository } from '@/modules/auth/repository/auth.api-repository';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    try {
      const me = await authRepository.getMe();
      if (me) throw redirect({ to: '/dashboard' });
      throw redirect({ to: '/login' });
    } catch (e) {
      if (isRedirect(e)) throw e;
    }
  },
  component: HomePage,
});

/** No debería mostrarse: `/` redirige a login o dashboard. */
function HomePage() {
  return null;
}
