import { createFileRoute, redirect } from '@tanstack/react-router';

/** Ruta histórica: la bandeja y la aprobación viven en Boletas Horas Extra. */
export const Route = createFileRoute('/_authenticated/horas-extra/aprobacion-horas-extra')({
  beforeLoad: () => {
    throw redirect({ to: '/horas-extra/registro-horas-extra', replace: true });
  },
  component: () => null,
});
