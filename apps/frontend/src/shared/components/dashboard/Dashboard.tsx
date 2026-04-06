/**
 * Vista `/dashboard`: bienvenida + rejilla de divisiones/módulos/apps según `navigation-config`
 * y `canAccessApp`. Es el “home” del producto; en el sidebar se enlaza como **Inicio** (primer ítem).
 */

import { Link } from '@tanstack/react-router';
import { canAccessApp } from '@/infrastructure/auth/permissions';
import type { MeResult } from '@/modules/auth/repository/auth.repository';
import {
  displayFirstName,
  getGreeting,
  getInitials,
} from '@/shared/lib/session-display';
import { getDivisionsWithModules } from '@/shared/components/sidebar/navigation-config';
import { NavIcon } from '@/shared/components/sidebar/NavIcon';

const SUBTITLE_FALLBACK = 'SAMI - Sistema Administrativo Modular Integrado';

type Props = {
  session: MeResult;
};

export function Dashboard({ session }: Props) {
  const hour = new Date().getHours();
  const greeting = getGreeting(hour);
  const firstName = displayFirstName(session);
  const displayName = firstName || session.workerName?.trim() || 'Usuario';
  const position = ''; // API aún no expone puesto; reservado
  const subtitle = position.trim() ? position : SUBTITLE_FALLBACK;
  const initials = getInitials('', '', session.workerName ?? '');

  const canAccess = (appSlug: string) => canAccessApp(session, appSlug);
  const divisions = getDivisionsWithModules(canAccess);

  return (
    <div className="min-w-0 flex-1 space-y-8 p-4 md:p-6">
      <section
        className="relative overflow-hidden rounded-xl px-6 py-8 text-primary-foreground shadow-sm md:px-10 md:py-10"
        style={{
          background: 'linear-gradient(105deg, #21a795 0%, #3ecfba 100%)',
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-lg font-medium md:text-xl">
              {greeting}, {displayName}
            </p>
            <p className="text-sm text-white/90">{subtitle}</p>
            <p className="pt-1 text-sm text-white/85">
              Código: {session.sapCode ?? ''}
            </p>
          </div>
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-[#21a795] md:h-16 md:w-16 md:text-xl"
            style={{ background: 'rgba(255,255,255,0.25)' }}
            aria-hidden
          >
            {initials}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Acceso directo a las apps y funciones disponibles para tu perfil
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {divisions.map((division) => (
            <div
              key={division.code}
              className="rounded-lg border border-border bg-muted/30 p-4 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-baseline gap-2 border-b border-border/80 pb-3">
                <span className="rounded bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  {division.code}
                </span>
                <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-foreground">
                  {division.label}
                </h2>
              </div>
              <div
                className={
                  division.resolvedModules.length === 1
                    ? 'grid grid-cols-1 gap-4'
                    : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2'
                }
              >
                {division.resolvedModules.map((mod) => (
                  <div key={mod.slug} className="min-w-0 space-y-3">
                    <h3 className="text-sm font-semibold uppercase text-primary">
                      {mod.label}
                    </h3>
                    <ul className="space-y-2">
                      {mod.visibleApps.map((app) => (
                        <li key={app.slug}>
                          <Link
                            to={app.path}
                            className="flex gap-3 rounded-md p-2 transition-colors hover:bg-primary/10"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                              <NavIcon name={app.icon} className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block font-semibold text-foreground">
                                {app.label}
                              </span>
                              <span className="block text-sm text-muted-foreground">
                                {app.description}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
