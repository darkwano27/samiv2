import { createFileRoute } from '@tanstack/react-router';
import { AppPlaceholderPage } from '@/shared/components/app-placeholder/AppPlaceholderPage';
import { assertAppAccess } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/horas-extra/registro-horas-extra')({
  beforeLoad: ({ context }) => {
    assertAppAccess(context.session, 'registro-horas-extra');
  },
  component: Page,
});

function Page() {
  return (
    <AppPlaceholderPage
      title="Registro de Horas Extra"
      description="Registra las horas extra trabajadas"
    />
  );
}
