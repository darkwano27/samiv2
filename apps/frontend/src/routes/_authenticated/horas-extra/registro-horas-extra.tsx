import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { BoletasHeShellView } from '@/modules/horas-extra/boletas-he/views/BoletasHeShellView';
import {
  RBAC_ENABLED,
  canAccessApp,
  canRead,
} from '@/infrastructure/auth/permissions';
import { assertBoletasHorasExtraAccess } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/horas-extra/registro-horas-extra')({
  beforeLoad: ({ context }) => {
    assertBoletasHorasExtraAccess(context.session);
  },
  component: Page,
});

const authenticatedRouteApi = getRouteApi('/_authenticated');

function Page() {
  const { session } = authenticatedRouteApi.useRouteContext();
  const showRegistroTab = canAccessApp(session, 'registro-horas-extra');
  const bandejaApi =
    RBAC_ENABLED && canRead(session, 'aprobacion-horas-extra', 'bandeja')
      ? ('aprobacion' as const)
      : ('registro' as const);

  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col">
      <BoletasHeShellView showRegistroTab={showRegistroTab} bandejaApi={bandejaApi} />
    </div>
  );
}
