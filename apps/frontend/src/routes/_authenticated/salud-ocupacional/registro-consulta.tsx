import { createFileRoute } from '@tanstack/react-router';
import { RegistroConsultaView } from '@/modules/salud-ocupacional/registro-consulta/views/RegistroConsultaView';
import { assertAppAccess } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/salud-ocupacional/registro-consulta')({
  beforeLoad: ({ context }) => {
    assertAppAccess(context.session, 'registro-consulta');
  },
  component: Page,
});

function Page() {
  return <RegistroConsultaView />;
}
