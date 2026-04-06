# Implementation Plan: SAMI Monorepo Setup

## Overview

Construcción incremental del monorepo SAMI v2 desde cero: primero la estructura raíz, luego el backend NestJS con todos sus módulos, y finalmente el frontend React+Vite. Cada tarea produce código compilable y funcional antes de avanzar a la siguiente.

## Tasks

- [ ] 1. Configurar estructura raíz del monorepo
  - Crear `pnpm-workspace.yaml` declarando `apps/*` y `packages/*`
  - Crear `turbo.json` con pipelines `dev`, `build`, `lint` y sus dependencias (`dependsOn`)
  - Crear `package.json` raíz con scripts `dev`, `build`, `lint` que deleguen a Turborepo y `devDependencies` con `turbo`
  - Crear `.gitignore` con entradas para `node_modules`, `dist`, `.env`, `.turbo`
  - Crear `CLAUDE.md` con comandos de desarrollo (`pnpm dev`, `pnpm build`, `pnpm --filter @sami/backend db:generate`, etc.) y decisiones de arquitectura (SWC, sesiones opacas, Argon2id, ky, TanStack Router, Drizzle, dual PostgreSQL)
  - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [ ] 2. Configurar el proyecto backend (NestJS + SWC)
  - [ ] 2.1 Crear `apps/backend/package.json` con nombre `@sami/backend`, scripts (`dev`, `build`, `start`, `lint`, `db:generate`, `db:migrate`, `db:studio`, `seed`, `seed:rbac`) y dependencias (`@nestjs/core`, `@nestjs/common`, `@nestjs/config`, `@nestjs/throttler`, `@nestjs/platform-express`, `drizzle-orm`, `postgres`, `ioredis`, `zod`, `cookie-parser`, `argon2`)
    - _Requirements: 2.2_
  - [ ] 2.2 Crear `apps/backend/tsconfig.json` con `paths` para `@core/*` → `src/core/*` y `@modules/*` → `src/modules/*`
    - _Requirements: 2.3_
  - [ ] 2.2b Crear `apps/backend/.swcrc` con `minify: false` (y paths coherentes con `tsconfig` si SWC los requiere). No usar `swcMinify` en `tsconfig.json` — no es una opción válida ahí.
    - _Requirements: 2.1_
  - [ ] 2.3 Crear `apps/backend/nest-cli.json` configurado con `compilerOptions.builder: "swc"` y `deleteOutDir: true`
    - _Requirements: 2.1_
  - [ ] 2.4 Crear `apps/backend/drizzle.config.ts` apuntando a `src/core/database/schema/*.ts` y output en `src/core/database/migrations`
    - _Requirements: 4.5, 4.6_
  - [ ] 2.5 Crear `apps/backend/.env.example` con todas las variables requeridas y sus descripciones (`DATABASE_URL`, `SAP_DATABASE_URL`, `REDIS_URL`, `PORT`, `NODE_ENV`, `SESSION_SECRET`, `SESSION_TTL`, `LDAP_*`, `EMAIL_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `THROTTLER_*`)
    - _Requirements: 3.6_

- [ ] 3. Implementar ConfigModule con validación Zod
  - [ ] 3.1 Crear `apps/backend/src/core/config/env.validation.ts` con el schema Zod (`envSchema`) y la función `validateEnv` que lanza error descriptivo si falla la validación
    - Incluir todos los campos del diseño: `DATABASE_URL`, `SAP_DATABASE_URL`, `REDIS_URL`, `PORT`, `NODE_ENV`, `SESSION_SECRET`, `SESSION_TTL`, `LDAP_*`, `EMAIL_ENABLED`, `SMTP_*`, `THROTTLER_TTL`, `THROTTLER_LIMIT`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 3.2 Escribir property test P1 para `validateEnv` — variables requeridas ausentes/inválidas
    - **Property 1: Validación de variables de entorno requeridas**
    - Usar `fast-check` para generar objetos de env con campos requeridos faltantes o con formato inválido
    - Verificar que `validateEnv` lanza un error que menciona el campo problemático
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
  - [ ]* 3.3 Escribir property test P2 para `validateEnv` — valores por defecto de variables opcionales
    - **Property 2: Variables opcionales tienen valores por defecto**
    - Usar `fast-check` para generar objetos de env con solo las variables requeridas válidas
    - Verificar que `validateEnv` retorna `PORT=3000`, `NODE_ENV='development'`, `SESSION_TTL=86400000`, `EMAIL_ENABLED=false`, `THROTTLER_TTL=60000`, `THROTTLER_LIMIT=100`
    - **Validates: Requirements 3.1, 3.4, 6.1, 6.2**

- [ ] 4. Implementar DatabaseModule (dual PostgreSQL)
  - [ ] 4.1 Crear schema Drizzle inicial en `apps/backend/src/core/database/schema/`: `workers.ts` (tabla `workers` con `id TEXT`, `name`, `email`, `isActive`, timestamps) y `sessions.ts` (tabla `sessions` con `id TEXT`, `workerId`, `expiresAt`, `createdAt`)
    - Crear `schema/index.ts` que re-exporte ambas tablas
    - Crear `schema-sap/eiis-trabajadores.ts` + `schema-sap/index.ts`: maestro read-only **`eiis_trabajadores`** (`pernr`, `stat2`, `correo_corp`, `correo`, `perid`, `vorna`, `nachn`, fechas de validez, etc.); sin migraciones desde este schema
    - _Requirements: 4.4_
  - [ ] 4.2 Crear `apps/backend/src/core/database/database.module.ts` con providers `SAMI_DB` y `SAP_DB`
    - `SAMI_DB`: conexión Drizzle read-write via `DATABASE_URL`; verificar con `SELECT 1` en el bootstrap; si falla, terminar el proceso
    - `SAP_DB`: conexión Drizzle read-only via `SAP_DATABASE_URL`; verificar con `SELECT 1` en el bootstrap; si falla, `console.warn` y retorna `null`
    - Exportar ambos tokens y el módulo
    - _Requirements: 4.1, 4.2, 4.3, 4.7, 4.8_
  - [ ]* 4.3 Escribir unit tests para `DatabaseModule`
    - Verificar que los providers exportan los tokens `SAMI_DB` y `SAP_DB`
    - Verificar comportamiento graceful de `SAP_DB` cuando la conexión falla
    - _Requirements: 4.3, 4.8_

- [ ] 5. Implementar RedisModule
  - [ ] 5.1 Crear `apps/backend/src/core/redis/redis.module.ts` con decorador `@Global()`, provider `REDIS_CLIENT` usando `ioredis` y `REDIS_URL`, verificando con `PING` en el factory (no depender solo de `client.on('error')`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 5.2 Escribir unit test para `RedisModule`
    - Verificar que tiene decorador `@Global()`
    - Verificar que exporta `REDIS_CLIENT`
    - _Requirements: 5.2, 5.3_

- [ ] 6. Implementar HealthController y AppModule
  - [ ] 6.1 Crear `apps/backend/src/core/health/health.controller.ts` con `GET /health` que retorna `{ status: 'ok', timestamp: new Date().toISOString() }`
    - _Requirements: 2.6_
  - [ ] 6.2 Crear `apps/backend/src/app.module.ts` importando `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`, `ThrottlerModule.forRootAsync` (leyendo `THROTTLER_TTL` y `THROTTLER_LIMIT` del `ConfigService`), `DatabaseModule`, `RedisModule`, `AuthModule`, `RbacModule`
    - Registrar `ThrottlerGuard` como `APP_GUARD` global
    - _Requirements: 2.5, 6.1, 6.2, 6.3, 7.4_
  - [ ] 6.3 Crear `apps/backend/src/main.ts` con `bootstrap()`: `NestFactory.create(AppModule)`, `app.use(cookieParser())`, `app.setGlobalPrefix('api')`, `app.enableCors({ origin: ['http://localhost:5173'], credentials: true })`, `app.listen(process.env.PORT || 3000)`
    - _Requirements: 2.5, 2.6_
  - [ ]* 6.4 Escribir unit tests para `HealthController`
    - Verificar que `check()` retorna `{ status: 'ok' }` con timestamp ISO válido
    - _Requirements: 2.6_

- [ ] 7. Implementar esqueletos AuthModule y RbacModule
  - [ ] 7.1 Crear estructura de subcarpetas y archivos esqueleto para `AuthModule`:
    - `apps/backend/src/modules/auth/controllers/auth.controller.ts`
    - `apps/backend/src/modules/auth/services/auth.service.ts`
    - `apps/backend/src/modules/auth/guards/.gitkeep` (u otro marcador para versionar la carpeta)
    - `apps/backend/src/modules/auth/decorators/.gitkeep`
    - `apps/backend/src/modules/auth/infrastructure/.gitkeep`
    - `apps/backend/src/modules/auth/auth.module.ts` — importa `AuthController` y `AuthService`
    - `AuthModule` preparado para sesiones opacas con HttpOnly cookie (NO JWT)
    - _Requirements: 7.1, 7.2_
  - [ ] 7.2 Crear estructura de subcarpetas y archivos esqueleto para `RbacModule`:
    - `apps/backend/src/modules/rbac/services/rbac.service.ts`
    - `apps/backend/src/modules/rbac/guards/.gitkeep`
    - `apps/backend/src/modules/rbac/decorators/.gitkeep`
    - `apps/backend/src/modules/rbac/rbac.module.ts` — importa `RbacService`
    - _Requirements: 7.3_
  - [ ] 7.3 Crear archivos de seed en `apps/backend/src/core/database/seed.ts` y `apps/backend/src/core/database/seed-rbac.ts`
    - Los scripts `seed` y `seed:rbac` en `package.json` deben apuntar a `src/core/database/seed.ts` y `src/core/database/seed-rbac.ts`
    - _Requirements: 7.5_

- [ ] 8. Checkpoint backend — verificar compilación
  - Verificar que `pnpm --filter @sami/backend build` compila sin errores de TypeScript
  - Asegurar que todos los imports de path aliases (`@core/*`, `@modules/*`) resuelven correctamente
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 2.4, 12.2_

- [ ] 9. Configurar el proyecto frontend (React + Vite)
  - [ ] 9.1 Crear `apps/frontend/package.json` con nombre `@sami/frontend`, scripts (`dev`, `build`, `lint`, `preview`) y dependencias (`react`, `react-dom`, `@tanstack/react-router`, `@tanstack/react-query`, `ky`, `tailwindcss`) y devDependencies (`vite`, `@vitejs/plugin-react`, `@tanstack/router-plugin`, `@tailwindcss/vite`, `typescript`)
    - _Requirements: 8.1, 8.2, 8.3_
  - [ ] 9.2 Crear `apps/frontend/tsconfig.json` con path alias `@/*` → `./src/*` y configuración estricta para React+Vite
    - _Requirements: 8.6_
  - [ ] 9.3 Crear `apps/frontend/vite.config.ts` con plugins `TanStackRouterVite`, `react()`, `tailwindcss()`, alias `@` → `./src`, `server.port: 5173`, y proxy `/api` → `http://localhost:3000`
    - _Requirements: 8.3, 8.5, 8.6, 9.1, 9.3, 10.2_
  - [ ] 9.4 Crear `apps/frontend/index.html` con `<div id="root">` y script apuntando a `src/app/main.tsx`
    - _Requirements: 8.2_
  - [ ] 9.5 Crear `apps/frontend/src/index.css` con directiva `@import "tailwindcss"` (Tailwind v4)
    - _Requirements: 8.3_

- [ ] 10. Implementar infraestructura frontend
  - [ ] 10.1 Crear `apps/frontend/src/infrastructure/http/client.ts` con instancia `ky` configurada con `prefixUrl: '/api'` y `credentials: 'include'`
    - _Requirements: 11.1, 11.2_
  - [ ] 10.2 Crear `apps/frontend/src/infrastructure/query/query-client.ts` con `QueryClient` configurado con `retry: false` y `staleTime: 5 * 60 * 1000`
    - _Requirements: 11.3_
  - [ ] 10.3 Crear `apps/frontend/src/infrastructure/auth/permissions.ts` con `RBAC_ENABLED = false` y función `canAccessApp` que retorna `true` cuando `RBAC_ENABLED` es `false`
    - _Requirements: 11.4_
  - [ ]* 10.4 Escribir unit tests para infraestructura frontend
    - Verificar `httpClient.prefixUrl === '/api'` y `credentials === 'include'`
    - Verificar `queryClient` tiene `retry: false` y `staleTime: 300000`
    - Verificar `RBAC_ENABLED === false` y `canAccessApp` retorna `true`
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 11. Implementar TanStack Router y punto de entrada
  - [ ] 11.1 Crear `apps/frontend/src/routes/__root.tsx` con `createRootRoute()`, `<Outlet />` y `TanStackRouterDevtools` en desarrollo
    - _Requirements: 10.3_
  - [ ] 11.2 Crear `apps/frontend/src/routes/index.tsx` con `createFileRoute('/')` como página de inicio
    - _Requirements: 10.4_
  - [ ] 11.3 Crear `apps/frontend/src/app/main.tsx` con `ReactDOM.createRoot`, envolviendo con `QueryClientProvider` y `RouterProvider`, importando `queryClient` y el `routeTree` generado por el plugin
    - Importar `@/index.css`
    - _Requirements: 10.1, 11.5_

- [ ] 12. Checkpoint final — verificar compilación completa
  - Verificar que `pnpm --filter @sami/frontend build` compila sin errores de TypeScript
  - Verificar que `pnpm install` desde la raíz instala todas las dependencias sin errores
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 12.1, 12.2, 12.3_

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requirements específicos para trazabilidad
- Los property tests usan `fast-check` con mínimo 100 iteraciones por propiedad
- El orden de las tareas es importante: ConfigModule debe existir antes que DatabaseModule y RedisModule
- Los path aliases del backend (`@core/*`, `@modules/*`) requieren configuración tanto en `tsconfig.json` como en `nest-cli.json` (para SWC)
- `SAP_DB` es tolerante a fallos — los servicios que lo inyecten deben verificar que no sea `null`
- Tailwind v4 usa `@import "tailwindcss"` en lugar de las directivas `@tailwind` de v3
