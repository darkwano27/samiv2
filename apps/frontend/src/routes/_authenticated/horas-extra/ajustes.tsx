import { createFileRoute } from '@tanstack/react-router';
import { WorkforceAjustesView } from '@/modules/horas-extra/ajustes/views/WorkforceAjustesView';
import {
  isWorkforceAjustesTab,
  type WorkforceAjustesTab,
} from '@/modules/horas-extra/ajustes/workforce-ajustes.types';
import { assertAppAccess } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/horas-extra/ajustes')({
  validateSearch: (search: Record<string, unknown>): { tab: WorkforceAjustesTab } => {
    const raw = search.tab;
    const normalized = raw === 'miembros' ? 'roles' : raw;
    return {
      tab: isWorkforceAjustesTab(normalized) ? normalized : 'organizacion',
    };
  },
  beforeLoad: ({ context }) => {
    assertAppAccess(context.session, 'horas-extra-ajustes');
  },
  component: WorkforceAjustesView,
});
