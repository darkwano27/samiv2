# Fase 3 — Frontend

## Objetivo

App React + Vite con TanStack Router (file-based), TanStack Query, ky, Tailwind v4, proxy `/api` y estructura `app/`, `routes/`, `infrastructure/`, `modules/auth/`, `shared/`.

## Requisitos Kiro cubiertos

Requirements **8**, **9**, **10**, **11** (y **12.1**, **12.3**–**12.5**).

## Entregables destacados

- `vite.config.ts` con `@tanstack/router-plugin/vite`, `@tailwindcss/vite`, alias `@`
- `src/infrastructure/http/client.ts`, `query/query-client.ts`, `auth/permissions.ts`
- `src/routes/__root.tsx` (`createRootRouteWithContext` + `queryClient`), `src/routes/index.tsx`, `src/routes/login.tsx`, `src/app/main.tsx`, `routeTree.gen.ts` (generado por el plugin en build)
- `src/index.css` con `@import "tailwindcss"`
- **Dashboard & shell:** `src/routes/_authenticated/route.tsx`, `dashboard.tsx`, rutas placeholder por app (17) en `src/routes/_authenticated/**`, `src/shared/components/{dashboard,sidebar,topbar,app-placeholder}/`, `src/shared/lib/session-display.ts`, `src/shared/routing/authenticated-guards.ts`, `src/modules/auth/hooks/use-logout.ts`
- **Gestión de usuarios:** `src/modules/admin/` + ruta real `administracion/gestion-usuarios` (TanStack Table, API `GET /api/admin/workers/directory`); ver `docs/features/user-directory.md`
- **Ajustes administración (SMTP sistema):** `administracion/ajustes` → `AdminAjustesPage`; reutiliza `salud-ocupacional/ajustes/components/SoEmailSettingsTab` con `variant="admin"` y API en `modules/admin/repository/admin.api-repository.ts` (solo superadmin; ver `permissions.ts` `SUPERADMIN_ONLY_NAV_APPS`). Documentación: `docs/features/module-email-pdf-architecture.md`, `docs/features/rbac-admin-api.md`
- UX shell (colores, migas en cabecera, scroll `h-dvh`, flyout colapsado, análisis módulo vs dashboard): `docs/frontend/shell-navigation-ux.md` y `docs/frontend/design-system.md` (*Shell autenticado*)

## Verificación

```bash
pnpm --filter @sami/frontend build
pnpm dev
# Navegador: http://localhost:5173
# API vía proxy: /api/health (backend en :3000)
```
