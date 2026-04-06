import { createFileRoute } from '@tanstack/react-router';
import { SistemasAjustesView } from '@/modules/sistemas/ajustes/views/SistemasAjustesView';
import {
  isSistemasAjustesTab,
  type SistemasAjustesTab,
} from '@/modules/sistemas/ajustes/sistemas-ajustes.types';
import { assertAppAccess } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/sistemas/ajustes')({
  validateSearch: (search: Record<string, unknown>): { tab: SistemasAjustesTab } => ({
    tab: isSistemasAjustesTab(search.tab) ? search.tab : 'miembros',
  }),
  beforeLoad: ({ context }) => {
    assertAppAccess(context.session, 'sistemas-ajustes');
  },
  component: SistemasAjustesView,
});
