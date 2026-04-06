import { createFileRoute, redirect } from '@tanstack/react-router';

/** Pantalla oculta temporalmente; restaurar entrada en `navigation-config` + assertAppAccess. */
export const Route = createFileRoute('/_authenticated/administracion/asignaciones')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' });
  },
  component: () => null,
});
