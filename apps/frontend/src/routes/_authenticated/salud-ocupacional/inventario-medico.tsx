import { createFileRoute } from '@tanstack/react-router';
import { InventarioMedicoView } from '@/modules/salud-ocupacional/inventario-medico/views/InventarioMedicoView';
import { assertAppAccess } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/salud-ocupacional/inventario-medico')({
  beforeLoad: ({ context }) => {
    assertAppAccess(context.session, 'inventario-medico');
  },
  component: Page,
});

function Page() {
  return <InventarioMedicoView />;
}
