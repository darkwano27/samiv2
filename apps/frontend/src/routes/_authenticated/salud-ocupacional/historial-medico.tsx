import { createFileRoute } from '@tanstack/react-router';
import { HistorialMedicoView } from '@/modules/salud-ocupacional/historial-medico/views/HistorialMedicoView';
import { assertAppAccess } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/salud-ocupacional/historial-medico')({
  beforeLoad: ({ context }) => {
    assertAppAccess(context.session, 'historial-medico');
  },
  component: Page,
});

function Page() {
  return <HistorialMedicoView />;
}
