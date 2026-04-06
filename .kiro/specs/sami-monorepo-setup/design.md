# Design Document — SAMI Monorepo Setup

## Overview

SAMI v2 es un monorepo gestionado con pnpm workspaces y Turborepo v2 que aloja dos aplicaciones: un backend NestJS y un frontend React+Vite. El objetivo de este setup es tener la infraestructura base lista para construir features encima, con ambas apps corriendo en desarrollo con un solo comando desde la raíz.

### Decisiones de diseño clave

- **Compilador SWC** en lugar de `tsc` para builds de desarrollo más rápidos en NestJS.
- **Sesiones opacas con HttpOnly cookie** (NO JWT) — el token de sesión vive en Redis, no en el cliente.
- **Argon2id** para hashing de passwords (NO bcrypt).
- **ky** como HTTP client en el frontend (NO axios).
- **TanStack Router file-based** (NO react-router) — las rutas se generan automáticamente desde la estructura de archivos.
- **Drizzle ORM** (NO Prisma) — schema-first, migraciones explícitas.
- **Dual PostgreSQL**: SAMI_DB (read-write) + SAP_DB (read-only, tolerante a fallos).
- **SAP_DB falla gracefully**: si no está disponible tras un round-trip real (`SELECT 1` al arrancar), el backend registra un warning pero no termina el proceso.
- **SWC**: opciones como desactivar minify se configuran en **`.swcrc`** (p. ej. `minify: false`), no en `tsconfig.json`.
- **RBAC_ENABLED = false** como feature flag en el frontend — desactivado en esta fase.

---

## Architecture

### Estructura del monorepo

```
sami-v2/
├── apps/
│   ├── backend/          # @sami/backend — NestJS + SWC + Drizzle
│   └── frontend/         # @sami/frontend — React + Vite + TanStack Router
├── packages/             # (vacío en esta fase, reservado para shared packages)
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── CLAUDE.md
```

### Diagrama de arquitectura

```mermaid
graph TD
    subgraph Workspace Root
        TJ[turbo.json]
        PW[pnpm-workspace.yaml]
        PKG[package.json]
    end

    subgraph apps/backend [@sami/backend]
        NestApp[NestJS App]
        ConfigMod[ConfigModule]
        DBMod[DatabaseModule]
        RedisMod[RedisModule]
        ThrottlerMod[ThrottlerModule]
        AuthMod[AuthModule skeleton]
        RbacMod[RbacModule skeleton]
        NestApp --> ConfigMod
        NestApp --> DBMod
        NestApp --> RedisMod
        NestApp --> ThrottlerMod
        NestApp --> AuthMod
        NestApp --> RbacMod
    end

    subgraph apps/frontend [@sami/frontend]
        ViteApp[Vite + React]
        TanStackRouter[TanStack Router]
        TanStackQuery[TanStack Query]
        HttpClient[ky httpClient]
        ViteApp --> TanStackRouter
        ViteApp --> TanStackQuery
        ViteApp --> HttpClient
    end

    DBMod -->|DATABASE_URL| SAMIDB[(SAMI PostgreSQL)]
    DBMod -->|SAP_DATABASE_URL| SAPDB[(SAP PostgreSQL)]
    RedisMod -->|REDIS_URL| Redis[(Redis)]
    HttpClient -->|/api proxy| NestApp
```

### Flujo de requests en desarrollo

```
Browser → http://localhost:5173
  └─ /api/* → Vite Dev Proxy → http://localhost:3000/api/*
                                  └─ NestJS (ThrottlerGuard → AuthGuard → Controller)
```

---

## Components and Interfaces

### Backend — AppModule

```ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([{
        ttl: config.get('THROTTLER_TTL', 60000),
        limit: config.get('THROTTLER_LIMIT', 100),
      }]),
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    RbacModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

### Backend — main.ts

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({ origin: ['http://localhost:5173'], credentials: true });
  await app.listen(process.env.PORT || 3000);
}
```

### Backend — DatabaseModule

Provee dos conexiones Drizzle como providers inyectables con tokens de inyección distintos:

```ts
// Tokens de inyección
export const SAMI_DB = 'SAMI_DB';
export const SAP_DB  = 'SAP_DB';

// Providers — verificar reachability con `SELECT 1` en el bootstrap.

const samiDbProvider = {
  provide: SAMI_DB,
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => {
    const client = postgres(config.getOrThrow('DATABASE_URL'));
    try {
      await client`SELECT 1`;
    } catch (e) {
      await client.end({ timeout: 2 }).catch(() => {});
      throw e;
    }
    return drizzle(client, { schema });
  },
};

const sapDbProvider = {
  provide: SAP_DB,
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => {
    let client: ReturnType<typeof postgres> | undefined;
    try {
      client = postgres(config.getOrThrow('SAP_DATABASE_URL'), { max: 5 });
      await client`SELECT 1`;
      return drizzle(client);
    } catch (err) {
      if (client) await client.end({ timeout: 2 }).catch(() => {});
      console.warn(
        '[DatabaseModule] SAP_DB connection failed — continuing without it:',
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  },
};
```

### Backend — RedisModule

```ts
import Redis from 'ioredis'; // ioredis — NO usar 'redis' (node-redis), API diferente

@Global()
@Module({
  providers: [{
    provide: 'REDIS_CLIENT',
    inject: [ConfigService],
    useFactory: async (config: ConfigService) => {
      const client = new Redis(config.getOrThrow('REDIS_URL'), {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      try {
        await client.connect();
        await client.ping();
      } catch (e) {
        client.disconnect();
        throw new Error(
          `Redis connection failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      return client;
    },
  }],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
```

### Backend — HealthController

```ts
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

### Backend — Env Validation (Zod)

```ts
const envSchema = z.object({
  // Core
  DATABASE_URL:      z.string().url(),
  SAP_DATABASE_URL:  z.string().url(),
  REDIS_URL:         z.string().url(),
  PORT:              z.coerce.number().default(3000),
  NODE_ENV:          z.enum(['development', 'production', 'test']).default('development'),
  // Auth
  SESSION_SECRET:    z.string().min(32),
  SESSION_TTL:       z.coerce.number().default(86400000),
  // LDAP
  LDAP_URL:          z.string().url(),
  LDAP_BASE_DN:      z.string(),
  LDAP_BIND_DN:      z.string(),
  LDAP_BIND_PASSWORD: z.string(),
  // Email (optional)
  EMAIL_ENABLED:     z.coerce.boolean().default(false),
  SMTP_HOST:         z.string().optional(),
  SMTP_PORT:         z.coerce.number().optional(),
  SMTP_USER:         z.string().optional(),
  SMTP_PASS:         z.string().optional(),
  // Throttler
  THROTTLER_TTL:     z.coerce.number().default(60000),
  THROTTLER_LIMIT:   z.coerce.number().default(100),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Environment validation failed:\n${result.error.toString()}`);
  }
  return result.data;
}
```

### Frontend — Infraestructura

```ts
// infrastructure/http/client.ts
export const httpClient = ky.create({
  prefixUrl: '/api',
  credentials: 'include',
});

// infrastructure/query/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
});

// infrastructure/auth/permissions.ts  ← ubicación correcta (NO shared/)
export const RBAC_ENABLED = false;
export function canAccessApp(_session: unknown, _appSlug: string): boolean {
  if (!RBAC_ENABLED) return true;
  return true;
}
```

### Frontend — Punto de entrada (app/main.tsx)

```tsx
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { routeTree } from './router/routeTree.gen';
import { queryClient } from '@/infrastructure/query/query-client';

const router = createRouter({ routeTree });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);
```

### Frontend — vite.config.ts

```ts
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/app/router/routeTree.gen.ts',
      quoteStyle: 'single',
    }),
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
});
```

---

## Data Models

### Schema Drizzle inicial

El schema inicial define las tablas base necesarias para verificar la conexión y soportar las features de autenticación y RBAC que se construirán encima.

```ts
// src/core/database/schema/workers.ts
// PLACEHOLDER — tabla temporal para verificar la conexión a SAMI_DB durante el setup.
// En la implementación real, los datos de workers se leen de SAP staging (read-only), tabla `eiis_trabajadores` (`pernr` = código SAP).
// La única tabla local definitiva para auth es `local_auth` (solo passwords locales).
export const workers = pgTable('workers', {
  id:        text('id').primaryKey(),          // TEXT, no UUID — alineado conceptualmente al pernr / sap_code
  name:      text('name').notNull(),
  email:     text('email'),
  isActive:  boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// src/core/database/schema/sessions.ts
// Tabla de auditoría — registro histórico de sesiones (quién se logueó cuándo).
// La sesión ACTIVA vive en Redis (TTL automático), NO en esta tabla.
// SessionService escribe en ambos: Redis para validación rápida, PostgreSQL para auditoría.
export const sessions = pgTable('sessions', {
  id:        text('id').primaryKey(),          // token opaco (UUID v4)
  workerId:  text('worker_id').notNull().references(() => workers.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// src/core/database/schema/index.ts
export * from './workers';
export * from './sessions';
```

### Drizzle config

```ts
// drizzle.config.ts
export default defineConfig({
  schema: './src/core/database/schema/*.ts',
  out:    './src/core/database/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

### Notas de diseño del schema

- `workers.id` es `TEXT` (NO UUID) — placeholder local; el código operativo del worker en auth es **`pernr`** en `eiis_trabajadores`.
- `auth_method` NO se almacena en la BD local — se determina en runtime consultando SAP staging (`stat2` activo + `correo_corp`).
- **Sesión activa**: vive en Redis con TTL automático. Es la fuente de verdad para validar si una sesión es válida.
- **Tabla `sessions` en PostgreSQL**: es para auditoría histórica (log de logins). `SessionService` escribe en ambos: Redis para validación rápida, PostgreSQL para registro histórico.
- **Tabla `workers`**: es un PLACEHOLDER temporal para verificar la conexión a SAMI_DB. No construir lógica de negocio encima — los datos reales de workers vienen de SAP staging (**`eiis_trabajadores`**).
- El schema SAP (read-only) vive en `src/core/database/schema-sap/` (p. ej. `eiis-trabajadores.ts`) y no genera migraciones.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Validación de variables de entorno requeridas

*For any* objeto de configuración de entorno, si alguna de las variables requeridas (`DATABASE_URL`, `SAP_DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `LDAP_URL`, `LDAP_BASE_DN`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`) está ausente o tiene un formato inválido, la función `validateEnv` debe lanzar un error descriptivo que identifique el campo problemático.

**Validates: Requirements 3.1, 3.2, 3.3, 3.5**

### Property 2: Variables opcionales tienen valores por defecto

*For any* objeto de configuración de entorno que contenga solo las variables requeridas (sin las opcionales), la función `validateEnv` debe completar exitosamente y retornar valores por defecto correctos: `PORT=3000`, `NODE_ENV='development'`, `SESSION_TTL=86400000`, `EMAIL_ENABLED=false`, `THROTTLER_TTL=60000`, `THROTTLER_LIMIT=100`.

**Validates: Requirements 3.1, 3.4, 6.1, 6.2**

---

## Error Handling

### Backend — Estrategia por módulo

| Módulo | Escenario de fallo | Comportamiento |
|--------|-------------------|----------------|
| ConfigModule | Variable requerida ausente o inválida | Lanza error descriptivo, proceso termina |
| DatabaseModule (SAMI_DB) | `SELECT 1` falla en el bootstrap | Lanza error, proceso termina |
| DatabaseModule (SAP_DB) | `SELECT 1` falla en el bootstrap | `console.warn`, proceso continúa con `null` |
| RedisModule | `PING` falla en el factory del provider | Lanza error, proceso termina |
| HealthController | Siempre disponible | Retorna `{ status: 'ok' }` |
| ThrottlerGuard | Límite excedido | HTTP 429 (estándar NestJS) |

### Principios

- **Fail fast**: los módulos críticos (ConfigModule, SAMI_DB, Redis) deben fallar en el arranque, no en runtime.
- **SAP_DB es tolerante**: puede no estar disponible en entornos de desarrollo local. Los servicios que lo usen deben verificar que el provider no sea `null` antes de usarlo.
- **Errores de validación Zod**: el mensaje de error debe incluir el nombre del campo y la razón del fallo (ej. `"DATABASE_URL: Invalid url"`).
- **CORS**: solo `http://localhost:5173` está permitido en desarrollo. En producción, configurar via variable de entorno.

### Frontend — Estrategia

- El `httpClient` (ky) lanza `HTTPError` para respuestas 4xx/5xx — los hooks de TanStack Query capturan estos errores y los exponen via `error` state.
- No hay retry automático (`retry: false` en QueryClient) — el usuario debe reintentar manualmente.
- Los errores de red (sin respuesta del servidor) se muestran como mensajes genéricos en la UI.

---

## Testing Strategy

### Enfoque dual: Unit tests + Property-based tests

Ambos tipos son complementarios:
- **Unit tests**: ejemplos específicos, verificación de configuraciones, edge cases.
- **Property tests**: propiedades universales sobre la validación de entorno.

### Property-Based Testing

**Librería seleccionada:** `fast-check` (TypeScript, compatible con Jest/Vitest)

**Configuración mínima:** 100 iteraciones por propiedad.

**Tag format:** `Feature: sami-monorepo-setup, Property {N}: {texto}`

| Propiedad | Test |
|-----------|------|
| P1: Validación de vars requeridas | Generar objetos de env con campos faltantes/inválidos, verificar que `validateEnv` lanza |
| P2: Defaults de vars opcionales | Generar objetos de env con solo vars requeridas, verificar valores por defecto |

### Unit Tests

Enfocados en verificaciones estructurales y de configuración:

**Backend:**
- `validateEnv` con un objeto de env completo y válido → retorna el objeto parseado
- `validateEnv` con `SESSION_SECRET` de menos de 32 chars → lanza error
- `validateEnv` con `DATABASE_URL` no-URL → lanza error
- `DatabaseModule` providers exportan tokens `SAMI_DB` y `SAP_DB`
- `HealthController.check()` retorna `{ status: 'ok' }` con timestamp ISO
- `AppModule` importa `AuthModule` y `RbacModule`
- `RedisModule` tiene decorador `@Global()`

**Frontend:**
- `httpClient` tiene `prefixUrl` configurado con `/api`
- `httpClient` tiene `credentials: 'include'`
- `queryClient` tiene `retry: false`
- `queryClient` tiene `staleTime: 300000`
- `RBAC_ENABLED` es `false` en `permissions.ts`
- `canAccessApp` retorna `true` cuando `RBAC_ENABLED = false`

### Cobertura mínima esperada

- `validateEnv`: 95%+ (lógica de validación crítica)
- `HealthController`: 100%
- `DatabaseModule` providers: 80%+
- `infrastructure/http/client.ts`: 80%+
- `infrastructure/query/query-client.ts`: 80%+
- `infrastructure/auth/permissions.ts`: 100%
