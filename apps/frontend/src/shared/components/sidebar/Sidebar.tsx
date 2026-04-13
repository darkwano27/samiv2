/**
 * Barra lateral del shell autenticado.
 *
 * - Desktop: columna fija `h-dvh` junto al contenido; el scroll vive **solo** en la columna derecha
 *   (`route.tsx` usa `h-dvh overflow-hidden`), así el sidebar no “se va” al hacer scroll.
 * - Fondo **`#00201B`**; primer ítem **Inicio** → `/dashboard`.
 * - **Colapsado:** iconos + menú flotante de apps vía `CollapsedModuleFlyout` (portal a `body`, no se recorta).
 * - **Drawer móvil:** siempre muestra **texto** de módulos y apps (`compactNav === false` en sheet).
 *
 * Persistencia: `sami-sidebar-active-module`, `sami-sidebar-collapsed`.
 */

import { Link, useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { canAccessApp, canAccessBoletasHorasExtraNav } from '@/infrastructure/auth/permissions';
import type { MeResult } from '@/modules/auth/repository/auth.repository';
import {
  CollapsedModuleFlyout,
  flyoutAnchorFromTrigger,
} from '@/shared/components/sidebar/collapsed-module-flyout';
import {
  getVisibleModules,
  MODULES,
  type ResolvedModule,
} from '@/shared/components/sidebar/navigation-config';
import { NavIcon } from '@/shared/components/sidebar/NavIcon';
import { cn } from '@/lib/utils';

const SIDEBAR_BG = '#00201B';

const LS_MODULE = 'sami-sidebar-active-module';
const LS_COLLAPSED = 'sami-sidebar-collapsed';

type Props = {
  session: MeResult;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
};

function moduleSlugForPath(pathname: string): string | null {
  if (pathname === '/dashboard') return null;
  const p =
    pathname === '/horas-extra/aprobacion-horas-extra'
      ? '/horas-extra/registro-horas-extra'
      : pathname;
  for (const m of MODULES) {
    if (m.apps.some((a) => p === a.path)) return m.slug;
  }
  return null;
}

function readLs(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLs(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

type FlyoutPayload = {
  mod: ResolvedModule;
  anchor: { top: number; left: number };
  triggerRect: DOMRect;
};

export function Sidebar({
  session,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose,
}: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const canAccess = useCallback(
    (slug: string) =>
      slug === 'registro-horas-extra'
        ? canAccessBoletasHorasExtraNav(session)
        : canAccessApp(session, slug),
    [session],
  );
  const modules = useMemo(() => getVisibleModules(canAccess), [canAccess]);

  const [expandedSlug, setExpandedSlug] = useState<string | null>(() => {
    const list = getVisibleModules((s) =>
      s === 'registro-horas-extra'
        ? canAccessBoletasHorasExtraNav(session)
        : canAccessApp(session, s),
    );
    const fromPath = moduleSlugForPath(pathname);
    if (fromPath && list.some((m) => m.slug === fromPath)) return fromPath;
    const saved = readLs(LS_MODULE);
    if (saved && list.some((m) => m.slug === saved)) return saved;
    return list[0]?.slug ?? null;
  });

  const [flyout, setFlyout] = useState<FlyoutPayload | null>(null);

  useEffect(() => {
    const fromPath = moduleSlugForPath(pathname);
    if (fromPath && modules.some((m) => m.slug === fromPath)) {
      setExpandedSlug(fromPath);
    }
  }, [pathname, modules]);

  useEffect(() => {
    if (!isCollapsed) setFlyout(null);
  }, [isCollapsed]);

  function toggleExpand(slug: string) {
    setFlyout(null);
    setExpandedSlug((prev) => {
      const next = prev === slug ? null : slug;
      if (next) writeLs(LS_MODULE, next);
      return next;
    });
  }

  function openOrToggleFlyout(mod: ResolvedModule, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    setFlyout((prev) =>
      prev?.mod.slug === mod.slug
        ? null
        : {
            mod,
            anchor: flyoutAnchorFromTrigger(rect),
            triggerRect: rect,
          },
    );
  }

  const dashboardActive = pathname === '/dashboard';
  const miFirmaActive = pathname === '/mi-firma';

  /** Inicio + Mi firma (PDFs / sellos). Iconos solo en desktop colapsado. */
  function renderGlobalShortcuts(opts: { inSheet?: boolean }) {
    const compactNav = isCollapsed && !opts.inSheet;
    const linkClass = (active: boolean) =>
      cn(
        'flex items-center gap-2 rounded-md py-2 text-sm font-medium transition-colors',
        compactNav ? 'justify-center px-0' : 'px-2',
        active
          ? 'bg-white/[0.12] text-white shadow-[inset_3px_0_0_#2DD4BF,inset_0_0_12px_rgba(0,0,0,0.15)]'
          : 'text-[#D1FAE5] hover:bg-white/[0.08]',
      );
    return (
      <div className="space-y-1 px-2 pt-2">
        <Link
          to="/dashboard"
          title="Inicio"
          onClick={() => opts.inSheet && onMobileClose()}
          className={linkClass(dashboardActive)}
        >
          <NavIcon name="LayoutDashboard" className="h-4 w-4 shrink-0 text-[#5EEAD4]" />
          {!compactNav ? <span>Inicio</span> : null}
        </Link>
        <Link
          to="/mi-firma"
          title="Mi firma para documentos"
          onClick={() => opts.inSheet && onMobileClose()}
          className={linkClass(miFirmaActive)}
        >
          <NavIcon name="PenLine" className="h-4 w-4 shrink-0 text-[#5EEAD4]" />
          {!compactNav ? <span>Mi firma</span> : null}
        </Link>
      </div>
    );
  }

  function renderNavList(list: ResolvedModule[], opts: { inSheet?: boolean }) {
    const compactNav = isCollapsed && !opts.inSheet;

    return (
      <ul className="flex flex-col gap-1 px-2 py-2">
        {list.map((mod) => {
          const open = expandedSlug === mod.slug;
          const hasActiveApp = mod.visibleApps.some((a) => pathname === a.path);
          const isModuleHighlighted = open || hasActiveApp;
          const flyoutOpen = flyout?.mod.slug === mod.slug;

          return (
            <li key={mod.slug}>
              {!compactNav ? (
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                    isModuleHighlighted
                      ? 'bg-white/[0.1] text-white shadow-[inset_3px_0_0_#2DD4BF,inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'text-[#D1FAE5] hover:bg-white/[0.06]',
                  )}
                  onClick={() => toggleExpand(mod.slug)}
                >
                  <NavIcon name={mod.icon} className="h-4 w-4 shrink-0 text-[#5EEAD4]" />
                  <span className="min-w-0 flex-1 truncate font-medium">{mod.label}</span>
                  <span className="text-xs text-[#94CFC4]" aria-hidden>
                    {open ? '▾' : '▸'}
                  </span>
                </button>
              ) : (
                <div className="relative flex justify-center">
                  <button
                    type="button"
                    data-sidebar-flyout-anchor="true"
                    title={mod.label}
                    aria-expanded={flyoutOpen}
                    aria-haspopup="menu"
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-md transition-colors',
                      hasActiveApp || flyoutOpen
                        ? 'bg-white/[0.12] text-white shadow-[inset_0_0_0_1px_rgba(45,212,191,0.35)]'
                        : 'text-[#D1FAE5] hover:bg-white/[0.08]',
                    )}
                    onClick={(e) => openOrToggleFlyout(mod, e.currentTarget)}
                  >
                    <NavIcon name={mod.icon} className="h-5 w-5 text-[#5EEAD4]" />
                  </button>
                </div>
              )}
              {!compactNav ? (
                <div
                  className="grid transition-[grid-template-rows] duration-200 ease-out"
                  style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <ul className="space-y-0.5 pb-2 pl-4">
                      {mod.visibleApps.map((app) => (
                        <li key={app.slug}>
                          <Link
                            to={app.path}
                            onClick={() => opts.inSheet && onMobileClose()}
                            className={cn(
                              'block rounded-md py-1.5 pl-2 text-sm transition-colors before:mr-2 before:inline-block before:text-[#6BB8A8] before:content-["•"]',
                              pathname === app.path
                                ? 'border-l-2 border-[#2DD4BF] bg-white/[0.08] font-medium text-white'
                                : 'text-[#C8EDE4] hover:bg-white/[0.06]',
                            )}
                          >
                            {app.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  const shellNav = (opts: { inSheet?: boolean }) => (
    <>
      {renderGlobalShortcuts(opts)}
      <div className="mx-2 my-2 border-t border-white/10" />
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label="Módulos y aplicaciones">
        {renderNavList(modules, opts)}
      </nav>
    </>
  );

  const brandHeader = (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-3',
        isCollapsed && 'flex-col px-2',
      )}
    >
      {!isCollapsed ? (
        <>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-bold tracking-tight text-white">ARIS</p>
            <p className="text-xs text-[#94CFC4]">SAMI v2</p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-[#94CFC4] transition-colors hover:bg-white/10 hover:text-white"
            onClick={onToggleCollapse}
            aria-label="Colapsar barra lateral"
          >
            «
          </button>
        </>
      ) : (
        <button
          type="button"
          className="rounded p-1 text-[#94CFC4] transition-colors hover:bg-white/10 hover:text-white"
          onClick={onToggleCollapse}
          aria-label="Expandir barra lateral"
          title="Expandir"
        >
          »
        </button>
      )}
    </div>
  );

  return (
    <>
      {flyout ? (
        <CollapsedModuleFlyout
          mod={flyout.mod}
          pathname={pathname}
          anchor={flyout.anchor}
          triggerRect={flyout.triggerRect}
          onClose={() => setFlyout(null)}
        />
      ) : null}

      <aside
        style={{ backgroundColor: SIDEBAR_BG }}
        className={cn(
          'hidden h-dvh min-h-0 shrink-0 flex-col border-r border-white/10 transition-[width] duration-200 ease-in-out md:flex',
          isCollapsed ? 'w-16' : 'w-[260px]',
        )}
        aria-label="Navegación principal"
      >
        {brandHeader}
        <div className="flex min-h-0 flex-1 flex-col">{shellNav({})}</div>
      </aside>

      <div className="md:hidden">
        {isMobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40"
            aria-label="Cerrar menú"
            onClick={onMobileClose}
          />
        ) : null}
        <aside
          style={{ backgroundColor: SIDEBAR_BG }}
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(300px,88vw)] flex-col border-r border-white/10 shadow-xl transition-transform duration-200 ease-out',
            isMobileOpen ? 'translate-x-0' : 'pointer-events-none -translate-x-full',
          )}
          aria-hidden={!isMobileOpen}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-3">
            <div>
              <p className="font-heading text-sm font-bold text-white">ARIS</p>
              <p className="text-xs text-[#94CFC4]">SAMI v2</p>
            </div>
            <button
              type="button"
              className="rounded p-2 text-[#94CFC4] hover:bg-white/10 hover:text-white"
              onClick={onMobileClose}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{shellNav({ inSheet: true })}</div>
        </aside>
      </div>
    </>
  );
}

export function useSidebarCollapsedPersistence() {
  const [isCollapsed, setIsCollapsed] = useState(() => readLs(LS_COLLAPSED) === '1');

  const toggle = useCallback(() => {
    setIsCollapsed((c) => {
      const next = !c;
      writeLs(LS_COLLAPSED, next ? '1' : '0');
      return next;
    });
  }, []);

  return { isCollapsed, setIsCollapsed, toggle };
}
