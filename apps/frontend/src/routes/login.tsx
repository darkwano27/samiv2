import { createFileRoute, redirect } from '@tanstack/react-router';
import { HTTPError } from 'ky';
import { httpClient } from '@/infrastructure/http/client';
import { LoginFlow } from '@/modules/auth/components/login/LoginFlow';
import { LoginHeroBackdrop } from '@/modules/auth/components/shared/LoginHeroBackdrop';
import { LoginMarketingBlock } from '@/modules/auth/components/shared/LoginMarketingBlock';

const COPYRIGHT_YEAR = new Date().getFullYear();

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    try {
      await httpClient.get('auth/me');
    } catch (e) {
      if (e instanceof HTTPError && e.response.status === 401) {
        return;
      }
      return;
    }
    throw redirect({ to: '/dashboard' });
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain md:min-h-0 md:bg-background">
      {/*
        Móvil: capa z-0 (evita z negativo detrás del fondo blanco del padre).
        Desktop: panel izquierdo usa la misma imagen en aside.
      */}
      <LoginHeroBackdrop className="absolute inset-0 z-0 md:hidden" />

      <div className="relative z-10 min-h-dvh flex-1 md:grid md:min-h-0 md:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] md:grid-rows-1 md:bg-background">
        <aside className="relative z-0 hidden min-h-dvh min-w-0 md:block md:min-h-0">
          <LoginHeroBackdrop className="absolute inset-0" />
          <div className="relative z-10 flex min-h-dvh items-center justify-center px-8 lg:px-12 md:min-h-0 md:h-full">
            <LoginMarketingBlock variant="desktop-panel" />
          </div>
        </aside>

        <main className="flex min-h-dvh min-w-0 flex-1 flex-col bg-transparent md:min-h-0 md:bg-background">
          <div className="flex min-h-0 flex-1 flex-col justify-center px-4 py-8 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] md:px-10 md:py-10 lg:px-14">
            <div className="mx-auto w-full max-w-md md:max-w-lg">
              <div className="mb-8 md:hidden">
                <LoginMarketingBlock variant="mobile" />
              </div>
              <LoginFlow />
            </div>
          </div>
          <footer className="shrink-0 space-y-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-center">
            <p className="hidden text-[0.65rem] text-muted-foreground/90 md:block">
              ARIS Industrial
            </p>
            <p className="text-[0.6875rem] text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] md:text-muted-foreground md:drop-shadow-none">
              © {COPYRIGHT_YEAR} SAMI — Todos los derechos reservados
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
