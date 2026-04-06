import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { routeTree } from './router/routeTree.gen';
import { queryClient } from '@/infrastructure/query/query-client';
import '@/index.css';

const router = createRouter({
  routeTree,
  context: { queryClient },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
