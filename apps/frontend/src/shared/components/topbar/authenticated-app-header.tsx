/**
 * Cabecera del área principal (columna derecha del layout autenticado).
 *
 * Fila única profesional:
 * - Móvil: [ menú ] [ migas de pan · scroll horizontal ] [ usuario · Salir ]
 * - Desktop: [ migas · flex ] [ usuario · Salir ]
 *
 * Las migas usan `ContentBreadcrumbs` con `layout="inline"`.
 */

import { LogOut } from 'lucide-react';
import { useLogout } from '@/modules/auth/hooks/use-logout';
import type { MeResult } from '@/modules/auth/repository/auth.repository';
import { getInitials } from '@/shared/lib/session-display';
import { ContentBreadcrumbs } from '@/shared/components/topbar/content-breadcrumbs';
import { Button } from '@/components/ui/button';

type Props = {
  session: MeResult;
  onMobileMenuOpen: () => void;
};

export function AuthenticatedAppHeader({ session, onMobileMenuOpen }: Props) {
  const logout = useLogout();
  const initials = getInitials('', '', session.workerName ?? '');
  const name = session.workerName?.trim() || session.sapCode || 'Usuario';

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-2 sm:gap-3 sm:px-4">
      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-lg text-foreground md:hidden"
        onClick={onMobileMenuOpen}
        aria-label="Abrir menú"
      >
        ☰
      </button>

      <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ContentBreadcrumbs layout="inline" className="py-0.5 text-xs sm:text-sm" />
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden min-w-0 max-w-[140px] text-right sm:block sm:max-w-[200px]">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">SAP {session.sapCode}</p>
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          aria-hidden
          title={name}
        >
          {initials}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 whitespace-nowrap"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <LogOut className="size-3.5" aria-hidden />
          Salir
        </Button>
      </div>
    </header>
  );
}
