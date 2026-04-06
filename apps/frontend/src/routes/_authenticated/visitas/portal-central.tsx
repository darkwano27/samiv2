import { createFileRoute, redirect } from '@tanstack/react-router';

/** Módulo oculto temporalmente; restaurar módulo en `navigation-config`. */
export const Route = createFileRoute('/_authenticated/visitas/portal-central')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' });
  },
  component: () => null,
});
