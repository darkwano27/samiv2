import { createFileRoute } from '@tanstack/react-router';
import { GestionUsuariosPage } from '@/modules/admin/pages/GestionUsuariosPage';
import { assertAppAccess } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/administracion/gestion-usuarios')({
  beforeLoad: ({ context }) => {
    assertAppAccess(context.session, 'gestion-usuarios');
  },
  component: Page,
});

function Page() {
  return <GestionUsuariosPage />;
}
