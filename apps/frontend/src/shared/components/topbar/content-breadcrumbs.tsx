/**
 * Migas de pan del shell autenticado.
 *
 * Por defecto van en la **cabecera** (`AuthenticatedAppHeader`), misma fila que usuario y Salir,
 * con `layout="inline"` para una sola línea con scroll horizontal si hace falta.
 *
 * Etiquetas: `route-labels.ts` (segmentos de URL → español).
 */

import { Link, useRouterState } from '@tanstack/react-router';
import { labelForSegment } from '@/shared/components/topbar/route-labels';
import { cn } from '@/lib/utils';

type Crumb = { label: string; to: string | undefined };

function buildBreadcrumbs(pathname: string): Crumb[] {
  if (pathname === '/dashboard') {
    return [{ label: 'Inicio', to: undefined }];
  }
  const segments = pathname.split('/').filter(Boolean);
  /** Solo el primer ítem (Inicio) es enlace; el resto son etiquetas (`to: undefined`). */
  const items: Crumb[] = [{ label: 'Inicio', to: '/dashboard' }];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    items.push({
      label: labelForSegment(seg),
      to: undefined,
    });
  }
  return items;
}

type Props = {
  className?: string;
  /** `inline`: una línea (cabecera). `default`: permite varias líneas si hay muchos segmentos. */
  layout?: 'default' | 'inline';
};

export function ContentBreadcrumbs({ className, layout = 'default' }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const crumbs = buildBreadcrumbs(pathname);

  return (
    <nav
      className={cn('text-sm text-muted-foreground', className)}
      aria-label="Migas de pan"
    >
      <ol
        className={cn(
          'flex items-center gap-x-1 gap-y-0.5',
          layout === 'inline' ? 'flex-nowrap' : 'flex-wrap',
        )}
      >
        {crumbs.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 ? <span className="text-border">/</span> : null}
            {c.to ? (
              <Link to={c.to} className="text-primary hover:underline">
                {c.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
