import { createFileRoute, redirect } from '@tanstack/react-router';

/** Módulo deshabilitado temporalmente; restaurar app en `navigation-config`. */
export const Route = createFileRoute('/_authenticated/salud-ocupacional/reportes')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' });
  },
  component: () => null,
});
