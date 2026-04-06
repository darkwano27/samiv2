/**
 * Layout de rutas autenticadas (`/_authenticated/*`).
 *
 * El contenedor raíz usa **`h-dvh max-h-dvh overflow-hidden`**: la altura queda anclada al viewport y
 * solo la columna derecha hace scroll (`flex-1 min-h-0 overflow-y-auto`). El sidebar **no se mueve**
 * al desplazar el contenido.
 *
 * Columna derecha: `AuthenticatedAppHeader` (migas + usuario + Salir) y debajo `<Outlet />`.
 */

import {
  createFileRoute,
  isRedirect,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { useState } from 'react';
import { authRepository } from '@/modules/auth/repository/auth.api-repository';
import { Sidebar, useSidebarCollapsedPersistence } from '@/shared/components/sidebar/Sidebar';
import { AuthenticatedAppHeader } from '@/shared/components/topbar/authenticated-app-header';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    try {
      const session = await authRepository.getMe();
      if (!session) throw redirect({ to: '/login' });
      return { session };
    } catch (e) {
      if (isRedirect(e)) throw e;
      throw redirect({ to: '/login' });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session } = Route.useRouteContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isCollapsed, toggle } = useSidebarCollapsedPersistence();

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar
        session={session}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggle}
        isMobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AuthenticatedAppHeader
          session={session}
          onMobileMenuOpen={() => setMobileOpen(true)}
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
