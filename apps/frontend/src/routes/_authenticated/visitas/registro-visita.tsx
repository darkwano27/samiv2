import { createFileRoute, redirect } from '@tanstack/react-router';

/** Módulo oculto temporalmente; restaurar módulo en `navigation-config`. */
export const Route = createFileRoute('/_authenticated/visitas/registro-visita')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' });
  },
  component: () => null,
});
