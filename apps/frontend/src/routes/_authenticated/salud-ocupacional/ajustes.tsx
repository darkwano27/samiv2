import { createFileRoute } from '@tanstack/react-router';
import { SoAjustesView } from '@/modules/salud-ocupacional/ajustes/views/SoAjustesView';
import {
  isSoAjustesTab,
  type SoAjustesTab,
} from '@/modules/salud-ocupacional/ajustes/so-ajustes.types';
import { assertAppAccess } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/salud-ocupacional/ajustes')({
  validateSearch: (search: Record<string, unknown>): { tab: SoAjustesTab } => ({
    tab: isSoAjustesTab(search.tab) ? search.tab : 'miembros',
  }),
  beforeLoad: ({ context }) => {
    assertAppAccess(context.session, 'salud-ocupacional-ajustes');
  },
  component: SoAjustesView,
});
