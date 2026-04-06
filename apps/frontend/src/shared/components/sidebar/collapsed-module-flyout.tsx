/**
 * Menú flotante de apps de un módulo cuando el sidebar está **colapsado** (solo iconos).
 *
 * Se renderiza con `createPortal` en `document.body` y posición `fixed` para no quedar recortado
 * por `overflow` del `<aside>` (antes el popover `absolute` quedaba invisible).
 */

import { Link } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ResolvedModule } from '@/shared/components/sidebar/navigation-config';
import { cn } from '@/lib/utils';

const PANEL_MIN_WIDTH = 220;
const PANEL_MAX_HEIGHT = 'min(70vh, 360px)';

type Props = {
  mod: ResolvedModule;
  pathname: string;
  /** Esquina superior izquierda del panel en coordenadas de viewport. */
  anchor: { top: number; left: number };
  /** Rect del botón que abrió el menú (para fallback de alineación). */
  triggerRect: DOMRect;
  onClose: () => void;
  /** Tras navegar (p. ej. cerrar drawer móvil). */
  onNavigate?: () => void;
};

export function CollapsedModuleFlyout({
  mod,
  pathname,
  anchor,
  triggerRect,
  onClose,
  onNavigate,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const margin = 8;
    const w = el.offsetWidth;
    let left = anchor.left;
    if (left + w > window.innerWidth - margin) {
      left = Math.max(margin, triggerRect.left - w - margin);
    }
    if (left < margin) left = margin;
    el.style.left = `${left}px`;

    const h = el.offsetHeight;
    let top = anchor.top;
    if (top + h > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - h - margin);
    }
    el.style.top = `${top}px`;
  }, [anchor.left, anchor.top, triggerRect.left, triggerRect.top, mod.slug]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onScroll() {
      onClose();
    }
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if ((e.target as HTMLElement).closest('[data-sidebar-flyout-anchor="true"]')) return;
      onClose();
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [onClose]);

  const node = (
    <div
      ref={panelRef}
      className="fixed z-[300] min-w-[220px] rounded-lg border border-border bg-popover p-2 shadow-xl"
      style={{
        top: anchor.top,
        left: anchor.left,
        maxHeight: PANEL_MAX_HEIGHT,
        minWidth: PANEL_MIN_WIDTH,
      }}
      role="menu"
      aria-label={`Aplicaciones de ${mod.label}`}
    >
      <p className="border-b border-border px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {mod.label}
      </p>
      <ul className="mt-2 max-h-[min(65vh,320px)] space-y-0.5 overflow-y-auto overscroll-contain">
        {mod.visibleApps.map((app) => (
          <li key={app.slug} role="none">
            <Link
              role="menuitem"
              to={app.path}
              onClick={() => {
                onNavigate?.();
                onClose();
              }}
              className={cn(
                'block rounded-md px-2 py-2 text-sm text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                pathname === app.path &&
                  'border-l-2 border-primary bg-primary/10 font-medium text-primary',
              )}
            >
              {app.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );

  return createPortal(node, document.body);
}

/** Calcula posición inicial a la derecha del botón, con margen. */
export function flyoutAnchorFromTrigger(rect: DOMRect): { top: number; left: number } {
  const margin = 8;
  return {
    top: rect.top,
    left: rect.right + margin,
  };
}
