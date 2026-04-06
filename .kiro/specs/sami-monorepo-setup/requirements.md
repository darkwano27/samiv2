# Requirements Document

## Introduction

SAMI v2 es un monorepo desde cero que integra un backend NestJS con Drizzle ORM (dual PostgreSQL) y un frontend React+Vite con TanStack Router. El objetivo de este setup es tener ambas aplicaciones corriendo en desarrollo con Turborepo, con la infraestructura base lista para construir features encima: autenticación por sesiones opacas con HttpOnly cookie, RBAC, y conexión a dos bases de datos PostgreSQL (SAMI app read-write + SAP staging read-only).

## Glossary

- **Monorepo**: Repositorio único que contiene múltiples aplicaciones y paquetes bajo `sami-v2/`.
- **Workspace_Root**: Directorio raíz del monorepo (`sami-v2/`), donde viven `pnpm-workspace.yaml`, `turbo.json` y `package.json`.
- **Backend**: Aplicación NestJS ubicada en `apps/backend/`, identificada como `@sami/backend`.
- **Frontend**: Aplicación React+Vite ubicada en `apps/frontend/`, identificada como `@sami/frontend`.
- **Turborepo**: Herramienta de build system para monorepos que orquesta tareas en paralelo.
- **pnpm_Workspaces**: Sistema de gestión de dependencias compartidas entre apps del monorepo.
- **Drizzle_ORM**: ORM TypeScript para PostgreSQL usado en el Backend.
- **SAMI_DB**: Base de datos PostgreSQL principal de la aplicación SAMI (read-write), referenciada por `DATABASE_URL`.
- **SAP_DB**: Base de datos PostgreSQL de staging SAP (read-only), referenciada por `SAP_DATABASE_URL`.
- **EIIS_Trabajadores**: Maestro de trabajadores en SAP staging; tabla **`eiis_trabajadores`**. El identificador del worker para auth es **`pernr`** (equivale al `sap_code` del API). Ver spec `sami-auth-multistep` para `stat2`, `correo_corp` y `correo`.
- **DatabaseModule**: Módulo NestJS que provee las conexiones Drizzle a SAMI_DB y SAP_DB.
- **ConfigModule**: Módulo NestJS (`@nestjs/config`) que carga y valida variables de entorno.
- **ThrottlerModule**: Módulo NestJS que implementa rate limiting.
- **RedisModule**: Módulo NestJS que provee conexión a Redis para almacenamiento de sesiones.
- **AuthModule**: Módulo NestJS esqueleto para autenticación por sesiones opacas con HttpOnly cookie.
- **RbacModule**: Módulo NestJS esqueleto para control de acceso basado en roles.
- **TanStack_Router**: Librería de routing file-based para React usada en el Frontend.
- **TanStack_Query**: Librería de server state management para React usada en el Frontend.
- **httpClient**: Instancia de `ky` configurada con `prefixUrl` y `credentials: 'include'` en `src/infrastructure/http/client.ts`.
- **QueryClient**: Instancia de TanStack_Query configurada con `retry: false` y `staleTime: 5min` en `src/infrastructure/query/query-client.ts`.
- **RBAC_Feature_Flag**: Constante `RBAC_ENABLED = false` en `permissions.ts` que desactiva RBAC en esta fase.
- **Dev_Proxy**: Configuración de Vite que redirige `/api/*` a `http://localhost:3000`.
- **SWC**: Compilador Rust-based usado por NestJS para builds más rápidos que `tsc`.
- **Argon2id**: Algoritmo de hashing de passwords usado en el Backend.

---

## Requirements

### Requirement 1: Estructura del Monorepo

**User Story:** Como desarrollador, quiero un monorepo configurado con pnpm workspaces y Turborepo para que pueda gestionar ambas aplicaciones desde la raíz con comandos unificados.

#### Acceptance Criteria

1. THE Workspace_Root SHALL contener un `pnpm-workspace.yaml` que declare `apps/*` y `packages/*` como workspaces.
2. THE Workspace_Root SHALL contener un `turbo.json` que defina los pipelines `dev`, `build`, `lint` con las dependencias entre tareas correctas.
3. THE Workspace_Root SHALL contener un `package.json` con los scripts `dev`, `build` y `lint` que deleguen a Turborepo.
4. WHEN se ejecuta `pnpm install` desde el Workspace_Root, THE Monorepo SHALL instalar todas las dependencias de Backend y Frontend sin errores.
5. WHEN se ejecuta `pnpm dev` desde el Workspace_Root, THE Turborepo SHALL arrancar Backend y Frontend en paralelo.
6. THE Workspace_Root SHALL contener un `CLAUDE.md` con los comandos de desarrollo y las decisiones de arquitectura del proyecto.

---

### Requirement 2: Configuración del Backend (NestJS)

**User Story:** Como desarrollador, quiero un Backend NestJS configurado con SWC y los módulos base para que pueda compilar y arrancar sin errores desde el primer momento.

#### Acceptance Criteria

1. THE Backend SHALL estar configurado con el compilador SWC en lugar de `tsc` para builds de desarrollo.
2. THE Backend SHALL tener un `package.json` con el nombre `@sami/backend` y los scripts: `dev`, `build`, `start`, `lint`, `db:generate`, `db:migrate`, `db:studio`, `seed`, `seed:rbac`.
3. THE Backend SHALL tener path aliases configurados en `tsconfig.json`: `@core/*` apuntando a `src/core/*` y `@modules/*` apuntando a `src/modules/*`.
4. WHEN se ejecuta `pnpm --filter @sami/backend build`, THE Backend SHALL compilar sin errores de TypeScript.
5. WHEN el Backend arranca, THE Backend SHALL escuchar en el puerto definido por la variable de entorno `PORT` con prefijo global `/api`.
6. THE Backend SHALL tener un endpoint `GET /api/health` que retorne HTTP 200 para verificar que el servidor está activo.

---

### Requirement 3: Variables de Entorno del Backend

**User Story:** Como desarrollador, quiero que el Backend valide sus variables de entorno al arrancar para que los errores de configuración sean detectados inmediatamente.

#### Acceptance Criteria

1. THE ConfigModule SHALL cargar y validar las siguientes variables de entorno al arrancar el Backend: `DATABASE_URL`, `SAP_DATABASE_URL`, `REDIS_URL`, `PORT`, `NODE_ENV`.
2. THE ConfigModule SHALL cargar y validar las variables de autenticación: `SESSION_SECRET`, `SESSION_TTL`.
3. THE ConfigModule SHALL cargar las variables LDAP: `LDAP_URL`, `LDAP_BASE_DN`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`.
4. THE ConfigModule SHALL cargar las variables de email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_ENABLED`.
5. IF alguna variable de entorno requerida está ausente al arrancar, THEN THE Backend SHALL lanzar un error descriptivo y terminar el proceso.
6. THE Backend SHALL incluir un archivo `.env.example` con todas las variables requeridas y sus descripciones.

---

### Requirement 4: DatabaseModule — Dual PostgreSQL

**User Story:** Como desarrollador, quiero que el Backend tenga conexiones configuradas a dos bases de datos PostgreSQL para que pueda leer datos de SAP staging y escribir en la base de datos SAMI.

#### Acceptance Criteria

1. THE DatabaseModule SHALL establecer una conexión Drizzle read-write a SAMI_DB usando `DATABASE_URL`.
2. THE DatabaseModule SHALL establecer una conexión Drizzle read-only a SAP_DB usando `SAP_DATABASE_URL`.
3. THE DatabaseModule SHALL exportar ambas conexiones como providers inyectables con tokens distintos (`SAMI_DB` y `SAP_DB`).
4. THE DatabaseModule SHALL definir el schema Drizzle inicial con al menos una tabla de ejemplo para verificar la conexión.
5. WHEN se ejecuta `pnpm --filter @sami/backend db:generate`, THE Drizzle_ORM SHALL generar los archivos de migración sin errores.
6. WHEN se ejecuta `pnpm --filter @sami/backend db:migrate`, THE Drizzle_ORM SHALL aplicar las migraciones a SAMI_DB sin errores.
7. IF la conexión a SAMI_DB falla al arrancar, THEN THE Backend SHALL lanzar un error descriptivo y terminar el proceso. THE verificación SHALL incluir un round-trip a la base (p. ej. `SELECT 1`), no solo instanciar el cliente.
8. IF la conexión a SAP_DB falla al arrancar (incluido el fallo del round-trip `SELECT 1`), THEN THE Backend SHALL registrar un warning en consola sin terminar el proceso, dado que SAP_DB es read-only y puede no estar disponible en todos los entornos. THE provider `SAP_DB` MAY ser `null` y los consumidores SHALL comprobarlo antes de usarlo.

---

### Requirement 5: RedisModule

**User Story:** Como desarrollador, quiero que el Backend tenga una conexión a Redis configurada para que las sesiones de usuario puedan ser almacenadas y recuperadas.

#### Acceptance Criteria

1. THE RedisModule SHALL establecer una conexión a Redis usando `REDIS_URL`.
2. THE RedisModule SHALL exportar la conexión Redis como provider inyectable.
3. THE RedisModule SHALL ser global para que cualquier módulo pueda inyectarlo sin importarlo explícitamente.
4. IF la conexión a Redis no es utilizable al arrancar, THEN THE Backend SHALL lanzar un error descriptivo y terminar el proceso. THE verificación SHALL usar un `PING` (o equivalente) en el factory del provider, no depender solo de un handler `error` asíncrono.

---

### Requirement 6: ThrottlerModule

**User Story:** Como desarrollador, quiero que el Backend tenga rate limiting configurado globalmente para que los endpoints sensibles estén protegidos desde el inicio.

#### Acceptance Criteria

1. THE ThrottlerModule SHALL estar configurado globalmente con un límite de 100 solicitudes por minuto por IP como configuración base.
2. THE ThrottlerModule SHALL leer su configuración desde las variables de entorno del ConfigModule.
3. THE Backend SHALL aplicar el ThrottlerModule como guard global en `AppModule`.

---

### Requirement 7: AuthModule y RbacModule (Esqueletos)

**User Story:** Como desarrollador, quiero que los módulos de autenticación y RBAC existan como esqueletos funcionales para que pueda construir sobre ellos sin refactorizar la estructura base.

#### Acceptance Criteria

1. THE AuthModule SHALL existir en `src/modules/auth/` con un `AuthController`, `AuthService` y `AuthModule` vacíos pero compilables.
2. THE AuthModule SHALL usar sesiones opacas con HttpOnly cookie como mecanismo de autenticación (NO JWT).
3. THE RbacModule SHALL existir en `src/modules/rbac/` con un `RbacService` y `RbacModule` vacíos pero compilables.
4. THE Backend SHALL registrar AuthModule y RbacModule en `AppModule`.
5. THE Backend SHALL tener scripts `seed` y `seed:rbac` en `package.json` que ejecuten archivos de seed en `src/core/database/seed.ts` y `src/core/database/seed-rbac.ts`.

---

### Requirement 8: Configuración del Frontend (React+Vite)

**User Story:** Como desarrollador, quiero un Frontend React+Vite configurado con TypeScript y las librerías del stack para que pueda compilar y arrancar sin errores desde el primer momento.

#### Acceptance Criteria

1. THE Frontend SHALL tener un `package.json` con el nombre `@sami/frontend`.
2. THE Frontend SHALL estar configurado con Vite, React y TypeScript.
3. THE Frontend SHALL tener Tailwind CSS v4 configurado usando el plugin `@tailwindcss/vite`.
4. WHEN se ejecuta `pnpm --filter @sami/frontend build`, THE Frontend SHALL compilar sin errores de TypeScript.
5. WHEN el Frontend arranca en desarrollo, THE Frontend SHALL servir en `http://localhost:5173`.
6. THE Frontend SHALL tener un path alias `@/*` configurado en `vite.config.ts` y `tsconfig.json` apuntando a `./src/*`.

---

### Requirement 9: Dev Proxy del Frontend

**User Story:** Como desarrollador, quiero que el Frontend redirija las llamadas `/api/*` al Backend en desarrollo para que no haya problemas de CORS durante el desarrollo local.

#### Acceptance Criteria

1. THE Dev_Proxy SHALL redirigir todas las solicitudes con prefijo `/api` a `http://localhost:3000` en el servidor de desarrollo Vite.
2. WHEN el Frontend realiza una solicitud a `/api/health`, THE Dev_Proxy SHALL redirigir la solicitud al Backend y retornar la respuesta sin modificaciones.
3. THE Dev_Proxy SHALL estar configurado únicamente en el entorno de desarrollo, no en el build de producción.

---

### Requirement 10: TanStack Router (File-Based)

**User Story:** Como desarrollador, quiero TanStack Router configurado con file-based routing para que las rutas se generen automáticamente a partir de la estructura de archivos.

#### Acceptance Criteria

1. THE Frontend SHALL usar TanStack Router con file-based routing (NO react-router).
2. THE Frontend SHALL tener el plugin `@tanstack/router-plugin/vite` configurado en `vite.config.ts` para generación automática de rutas.
3. THE Frontend SHALL tener una ruta raíz (`routes/__root.tsx`) que incluya el `RouterDevtools` en desarrollo.
4. THE Frontend SHALL tener una ruta index (`routes/index.tsx`) como página de inicio.
5. THE Frontend SHALL tener la estructura de carpetas: `app/`, `routes/`, `modules/auth/`, `shared/`, `infrastructure/`.

---

### Requirement 11: httpClient e Infraestructura Frontend

**User Story:** Como desarrollador, quiero que el httpClient y el QueryClient estén configurados como singletons para que toda la aplicación use la misma instancia con la configuración correcta.

#### Acceptance Criteria

1. THE httpClient SHALL ser una instancia de `ky` configurada con `prefixUrl: '/api'` y `credentials: 'include'` en `src/infrastructure/http/client.ts`.
2. THE Frontend SHALL usar `ky` como HTTP client (NO axios).
3. THE QueryClient SHALL estar configurado con `retry: false` y `staleTime: 5 * 60 * 1000` (5 minutos) en `src/infrastructure/query/query-client.ts`.
4. THE Frontend SHALL tener un archivo `src/infrastructure/auth/permissions.ts` con la constante `RBAC_ENABLED = false` como feature flag.
5. THE Frontend SHALL envolver la aplicación con `QueryClientProvider` y `RouterProvider` en el punto de entrada `src/app/main.tsx`.

---

### Requirement 12: Validación End-to-End del Setup

**User Story:** Como desarrollador, quiero poder verificar que todo el stack funciona correctamente con comandos simples para que pueda confirmar que el setup está listo para desarrollo.

#### Acceptance Criteria

1. WHEN se ejecuta `pnpm install` desde el Workspace_Root, THE Monorepo SHALL completar sin errores.
2. WHEN se ejecuta `pnpm --filter @sami/backend build`, THE Backend SHALL compilar sin errores.
3. WHEN se ejecuta `pnpm --filter @sami/frontend build`, THE Frontend SHALL compilar sin errores.
4. WHEN se ejecuta `pnpm dev` desde el Workspace_Root, THE Backend SHALL responder en `http://localhost:3000/api/health` y THE Frontend SHALL cargar en `http://localhost:5173`.
5. WHEN el Frontend realiza una solicitud a `/api/health` en desarrollo, THE Dev_Proxy SHALL retornar la respuesta del Backend correctamente.
6. WHEN las variables `DATABASE_URL` y `SAP_DATABASE_URL` apuntan a instancias PostgreSQL activas, THE DatabaseModule SHALL establecer ambas conexiones sin errores.
