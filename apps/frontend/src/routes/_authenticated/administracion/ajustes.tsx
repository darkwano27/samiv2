import { createFileRoute } from '@tanstack/react-router';
import { AdminAjustesPage } from '@/modules/admin/pages/AdminAjustesPage';
import { assertAppAccess } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/administracion/ajustes')({
  beforeLoad: ({ context }) => {
    assertAppAccess(context.session, 'administracion-ajustes');
  },
  component: Page,
});

function Page() {
  return <AdminAjustesPage />;
}
