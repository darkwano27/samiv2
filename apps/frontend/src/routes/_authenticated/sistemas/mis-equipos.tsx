import { createFileRoute } from '@tanstack/react-router';
import { MisEquiposView } from '@/modules/sistemas/mis-equipos/views/MisEquiposView';
import { assertAppAccess, assertFeatureRead } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/sistemas/mis-equipos')({
  beforeLoad: ({ context }) => {
    assertAppAccess(context.session, 'mis-equipos');
    assertFeatureRead(context.session, 'mis-equipos', 'listar');
  },
  component: MisEquiposView,
});
