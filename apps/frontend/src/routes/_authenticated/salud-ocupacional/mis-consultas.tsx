import { createFileRoute } from '@tanstack/react-router';
import { MisConsultasView } from '@/modules/salud-ocupacional/mis-consultas/views/MisConsultasView';
import { assertAppAccess } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/salud-ocupacional/mis-consultas')({
  beforeLoad: ({ context }) => {
    assertAppAccess(context.session, 'mis-consultas');
  },
  component: Page,
});

function Page() {
  return <MisConsultasView />;
}
