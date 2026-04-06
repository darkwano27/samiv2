# Fase 0 — Raíz del monorepo

## Objetivo

Tener la base del workspace: pnpm workspaces, Turborepo, scripts unificados y documentación mínima para desarrollar desde la raíz.

## Requisitos Kiro cubiertos

Requirement **1** (1.1–1.6).

## Entregables

- `pnpm-workspace.yaml`, `turbo.json`, `package.json` raíz
- `.gitignore`, `CLAUDE.md`
- `packages/` reservado (p. ej. `.gitkeep`)

## Verificación

```bash
pnpm install
pnpm exec turbo run build --dry-run
```

Tras añadir apps: `pnpm dev` debe arrancar backend y frontend en paralelo.
