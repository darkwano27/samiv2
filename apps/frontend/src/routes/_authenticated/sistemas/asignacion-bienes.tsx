import { createFileRoute } from '@tanstack/react-router';
import { AsignacionBienesView } from '@/modules/sistemas/asignacion-bienes/views/AsignacionBienesView';
import { assertAppAccess, assertFeatureRead } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/sistemas/asignacion-bienes')({
  beforeLoad: ({ context }) => {
    assertAppAccess(context.session, 'asignacion-bienes');
    assertFeatureRead(context.session, 'asignacion-bienes', 'operar');
  },
  component: AsignacionBienesView,
});
