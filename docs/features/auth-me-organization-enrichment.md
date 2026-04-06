# Enriquecimiento de `GET /auth/me` con contexto organizacional (SAP staging)

## Objetivo

Exponer en la sesión autenticada la **división** y **subdivisión** del trabajador, alineadas al modelo de datos de `pid_sistemas`, con trazabilidad clara de fuentes y fallbacks.

## Contexto y decisión

- **`eiis_trabajadores`**: fila vigente por `pernr` (mismo criterio que el resto de auth: último registro por `begda` / `id_registro`).
- **`werks`** = código de división → catálogo **`eiis_divisiones.codigo_division`**.
- **`btrtl`** = código de subdivisión → catálogo **`eiis_subdivisiones.codigo_subdivision`**.
- **Nombres**: primero se intenta el catálogo maestro; si no hay fila (o SAP no responde), se usa **`txt_div`** / **`txt_subdiv`** del trabajador como respaldo.

## Contrato HTTP (200)

Campos existentes (sin cambios semánticos):

- `sap_code` — de la sesión Redis.
- `worker_name` — el guardado al crear la sesión (no se recalcula en cada `/me`).

Campos RBAC (ver también fase 2 y `.kiro/specs/sami-rbac/`):

- `worker_id` — igual a `sap_code` (FK lógica hacia `workers.id`).
- `is_superadmin` — `true` si el trabajador tiene asignación activa al rol `superadmin` (app `sami-platform`).
- `app_roles` — lista de asignaciones con `app_slug`, `module_slug`, `role_slug`, `role_level`, `scope`, `scope_id`, `permissions` (mapa feature → acciones).
- `managed_module_slugs` — `string[]`: slugs de módulo (`NavModule.slug`, p. ej. `salud-ocupacional`) donde el usuario tiene rol sobre una app con `is_management` (admin de módulo). El frontend usa esto con `canAccessApp` para mostrar todas las apps de ese módulo en sidebar/dashboard cuando `VITE_RBAC_ENABLED=true`.

Campos organización SAP (siempre presentes; pueden ser `null`):

- `division`: `{ code: string, name: string | null } | null` — `null` si no hay `werks`.
- `subdivision`: `{ code: string, name: string | null } | null` — `null` si no hay `btrtl`.

`name` puede ser `null` si no hay fila en catálogo ni texto en el trabajador.

## Comportamiento ante fallos

- **Sin conexión SAP / `SAP_DB` no configurado / error de consulta**: se devuelve `200` con `sap_code` y `worker_name`; `division` y `subdivision` en `null`. Se registra advertencia en log para diagnóstico.
- **Trabajador no encontrado** en staging (caso raro tras login válido): mismo criterio que arriba.
- **401**: solo si la cookie `sami_session` no es válida (sin cambios).

## Implementación (referencia de código)

- Backend: `AuthService.getMeFromSessionToken` — consultas Drizzle a `eiis_divisiones` y `eiis_subdivisiones` vía `schema-sap`.
- Frontend: tipos `MeResult` / DTO del repositorio alineados al JSON anterior.
- Esquemas SAP: `eiis-divisiones.ts`, `eiis-subdivisiones.ts`, `eiis-trabajadores.ts`.

## UI

La ruta **`/`** (home) usa `authRepository.getMe()` en el loader y muestra división/subdivisión cuando vienen en la respuesta; si ambas son `null`, un mensaje breve indica ausencia de dato SAP o staging no disponible.

## Verificación

```bash
pnpm --filter @sami/backend build
pnpm --filter @sami/frontend build
```

Manual: `GET /api/auth/me` con cookie de sesión válida; comprobar que códigos coinciden con `werks`/`btrtl` y nombres con catálogo o `txt_*`.

## Relación con RBAC futuro

Este bloque **no** implementa permisos ni `scope_id`. Cuando exista RBAC, el mismo contexto (`division` / `subdivision`) podrá cruzarse con asignaciones de roles; este documento queda como fuente de verdad del **origen SAP** de esos códigos.

## Historial

| Fecha      | Cambio                                      |
| ---------- | ------------------------------------------- |
| 2026-03-27 | Primera versión: plan + contrato + ejecución |
