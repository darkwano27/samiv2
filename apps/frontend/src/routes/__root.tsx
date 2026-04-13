import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools /> : null}
    </div>
  );
}
