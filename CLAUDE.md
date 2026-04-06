# SAMI v2 — notas para desarrollo

Monorepo con **pnpm workspaces** y **Turborepo**: backend **NestJS** (`@sami/backend`) y frontend **React + Vite** (`@sami/frontend`).

## Comandos

| Comando | Descripción |
|--------|-------------|
| `pnpm install` | Instala dependencias de todo el workspace |
| `pnpm dev` | Arranca backend y frontend en paralelo (Turbo) |
| `pnpm build` | Build de todas las apps |
| `pnpm lint` | Lint en todas las apps |
| `pnpm --filter @sami/backend db:generate` | Genera migraciones Drizzle |
| `pnpm --filter @sami/backend db:migrate` | Aplica migraciones a SAMI_DB |
| `pnpm --filter @sami/backend db:studio` | Drizzle Studio |
| `pnpm --filter @sami/backend seed` | Seed principal |
| `pnpm --filter @sami/backend seed:rbac` | Seed RBAC |

## Decisiones de arquitectura

- **NestJS** compilado con **SWC** (build más rápido que `tsc` solo).
- **Sesiones opacas** en **HttpOnly cookie**; estado de sesión en **Redis** (no JWT en cliente).
- **Argon2id** para hashes de contraseña (no bcrypt).
- **Drizzle ORM** + **PostgreSQL** dual: `DATABASE_URL` (SAMI, read-write) y `SAP_DATABASE_URL` (SAP staging, tolerante a fallo tras `SELECT 1`).
- **Redis** (`REDIS_URL`) verificado con **PING** al arrancar.
- Frontend: **TanStack Router** (file-based), **TanStack Query**, **ky** (no axios), **Tailwind v4** (`@tailwindcss/vite`).
- En desarrollo, Vite hace **proxy** de `/api` → `http://localhost:3000`.
- **RBAC** en frontend desactivado con `RBAC_ENABLED = false` en `permissions.ts` (fase actual).

Spec detallado: `.kiro/specs/sami-monorepo-setup/`, `.kiro/specs/sami-auth-multistep/`, **`.kiro/specs/sami-rbac/`** (canónico para RBAC; mantener solo esta copia en el monorepo) y `docs/phases/`.

## Auth multi-step (SAP + local) — alineado al mapa de datos

- **SAP (read-only)**: tabla `eiis_trabajadores` con `pernr` (número de personal = código SAP), `stat2` (**3 = activo**, **0 = baja**), `vorna`/`nachn`, `perid` (DNI), `correo` (personal), `correo_corp` (si tiene valor ⇒ AD). Con histórico, se toma la fila más reciente por `begda`/`id_registro`. El `sap_code` del API es el `pernr`.
- **AD**: búsqueda LDAP con cuenta de servicio (`LDAP_BIND_DN` / `LDAP_BIND_PASSWORD`), filtro por atributo configurable (`LDAP_POSTALCODE_ATTR`, default `postalCode`) = `pernr`, luego **bind** con el DN del usuario y su contraseña. Opcional: `LDAP_SEARCH_BASE`, `LDAP_AUTH_FILTER` con `{sapCode}`.
- **SAMI**: `local_auth` (`sap_code` = `pernr`), tabla `sessions` con `sap_code` + token opaco (sin FK a `workers`; migración `0002_align_sessions_sap_code.sql`).
- Sesión activa: **Redis** `sess:{uuid}` **y** fila en **PostgreSQL** `sessions`.
- Rate limit **10 req/min** en `identify` y `login`.
