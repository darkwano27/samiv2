import { createFileRoute } from '@tanstack/react-router';
import { ReportesSoView } from '@/modules/salud-ocupacional/reportes/views/ReportesSoView';
import { assertAppAccess } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/salud-ocupacional/reportes')({
  beforeLoad: ({ context }) => {
    assertAppAccess(context.session, 'reportes-so');
  },
  component: Page,
});

function Page() {
  return <ReportesSoView />;
}
