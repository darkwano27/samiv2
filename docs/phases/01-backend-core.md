# Fase 1 — Backend core

## Objetivo

Backend NestJS compilable con validación de entorno (Zod), Drizzle dual (SAMI + SAP tolerante), Redis con PING, health check, Throttler global y prefijo `/api`.

## Requisitos Kiro cubiertos

Requirements **2**, **3**, **4**, **5**, **6** (y partes de **12.2**).

## Entregables destacados

- `apps/backend`: SWC (`.swcrc` + `nest-cli.json`), `env.validation.ts`, `DatabaseModule`, `RedisModule`, `HealthController`/`HealthModule`, `AppModule`, `main.ts`
- Schema Drizzle `workers` + `sessions`, `schema-sap` con maestro **`eiis_trabajadores`** (read-only, sin migraciones SAP), `drizzle.config.ts`, migraciones generables (solo SAMI)
- `.env.example`

## Verificación

```bash
pnpm --filter @sami/backend build
# Con .env válido (PostgreSQL + Redis accesibles):
pnpm --filter @sami/backend start
curl http://localhost:3000/api/health
```
