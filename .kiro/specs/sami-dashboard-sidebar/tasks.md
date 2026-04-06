# Implementation Plan: SAMI Dashboard & Sidebar

> **Copia de trabajo** en el monorepo `sami-V2`. Todas las rutas `src/…` del plan original = `apps/frontend/src/…`.

## Overview

Implementación incremental del sistema de navegación de SAMI v2: navigation config centralizado, 20 route files placeholder, layout autenticado, Dashboard, Sidebar (expandido/colapsado/mobile), SidebarFooter, Topbar y fix de sesión. Stack: React + Vite + TypeScript + TanStack Router + TanStack Query + Tailwind CSS v4 + lucide-react.

## Tasks

- [ ] 1. Crear navigation-config.ts — interfaces, catálogo y helpers
  - Crear `apps/frontend/src/shared/components/sidebar/navigation-config.ts`
  - Definir interfaces `NavApp`, `NavModule`, `NavDivision`
  - Exportar constantes `DIVISIONS` (7 divisiones) y `MODULES` (6 módulos con 17 apps; sin app de sync: maestro SAP es lectura en runtime)
  - Implementar `getDivisionsWithModules(canAccess)` excluyendo divisiones sin módulos visibles
  - Implementar `getVisibleModules(canAccess)` excluyendo módulos sin apps accesibles
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [ ]* 1.1 Property test P1: getDivisionsWithModules nunca retorna divisiones con módulos vacíos
    - **Property 1: getDivisionsWithModules never returns divisions with empty modules**
    - **Validates: Requirements 1.6, 1.8**

  - [ ]* 1.2 Property test P2: getVisibleModules nunca retorna módulos con apps vacías
    - **Property 2: getVisibleModules never returns modules with empty apps**
    - **Validates: Requirements 1.7, 1.9**

  - [ ]* 1.3 Unit tests para navigation-config.ts
    - Verificar que DIVISIONS tiene 7 entradas y MODULES tiene 6 entradas
    - Verificar que los 20 paths están definidos en el catálogo
    - `getDivisionsWithModules(() => true)` retorna todas las divisiones con módulos
    - `getDivisionsWithModules(() => false)` retorna array vacío
    - `getVisibleModules(() => true)` retorna los 6 módulos
    - `getVisibleModules(() => false)` retorna array vacío
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_


- [ ] 2. Crear los 20 route files placeholder bajo `apps/frontend/src/routes/_authenticated/`
  - Crear los directorios: `horas-extra/`, `salud-ocupacional/`, `visitas/`, `crm-quimicos/`, `sistemas/`, `administracion/`
  - Crear los 20 archivos `.tsx` con `createFileRoute`, componente placeholder (`<h1>`, descripción, "Módulo en desarrollo") y `beforeLoad` guard
  - El `beforeLoad` llama `canAccessApp(context.session!, appSlug)` y lanza `redirect({ to: '/dashboard' })` si no tiene acceso
  - NO crear carpetas bajo `apps/frontend/src/modules/`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.1 Property test P3: canAccessApp con RBAC_ENABLED=false siempre retorna true
    - **Property 3: canAccessApp with RBAC_ENABLED=false always returns true**
    - **Validates: Requirements 2.2, 2.6**

  - [ ]* 2.2 Unit tests para route beforeLoad guard
    - Verificar que el guard redirige a `/dashboard` cuando `canAccessApp` retorna `false`
    - Verificar que el guard no redirige cuando `canAccessApp` retorna `true`
    - _Requirements: 2.2, 2.6_

- [ ] 3. Checkpoint — Verificar que el route tree compila sin errores
  - Asegurar que `pnpm tsc --noEmit` pasa sin errores en los 20 route files y navigation-config.ts
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [ ] 4. Implementar layout `_authenticated` con Topbar + Sidebar + Outlet
  - Crear o modificar `apps/frontend/src/routes/_authenticated.tsx` (layout route de TanStack Router)
  - Gestionar estado `isCollapsed`, `isMobileOpen` en el layout y pasarlos como props a Sidebar
  - Renderizar `<Topbar onMobileMenuOpen={...} />`, `<Sidebar ... />` y `<Outlet />`
  - El layout redirige a `/login` si la sesión falla definitivamente (401/500 tras reintentos)
  - _Requirements: 7.2, 9.1_

- [ ] 5. Implementar Dashboard — banner de bienvenida y sección de módulos
  - Crear `apps/frontend/src/shared/components/dashboard/Dashboard.tsx`
  - Implementar función `getGreeting(hour)` que retorna "Buenos días" (5–11), "Buenas tardes" (12–17), "Buenas noches" (18–4)
  - Implementar función `getInitials(firstName, lastName, workerName)` que retorna 1–2 caracteres en mayúsculas (si no hay first/last, derivar de `workerName`)
  - Renderizar banner con gradiente `#21a795`, saludo dinámico con nombre mostrable (ver Req 3.2), avatar con iniciales, `position` o fallback, "Código: {sapCode}"
  - Renderizar sección de módulos llamando `getDivisionsWithModules(canAccess)`, layout responsive (1/2/3 columnas), navegación al hacer click en app
  - Todos los campos de sesión usan `?? ''` para evitar "undefined" en UI
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [ ]* 5.1 Property test P4: el saludo dinámico cubre todas las horas del día
    - **Property 4: greeting covers all hours (0–23)**
    - **Validates: Requirements 3.2**

  - [ ]* 5.2 Property test P5: las iniciales del avatar son siempre 1–2 caracteres en mayúsculas
    - **Property 5: initials are 1-2 uppercase chars**
    - **Validates: Requirements 3.4, 8.1**

  - [ ]* 5.3 Unit tests para Dashboard
    - Renderiza "Buenos días" para hora 10:00
    - Renderiza "SAMI - Sistema Administrativo Modular Integrado" cuando `position` está vacío
    - Renderiza `position` cuando está presente
    - Renderiza "SAMI v2" (no "SAMI v3") en referencias al sistema
    - _Requirements: 3.2, 3.3, 10.4_


- [ ] 6. Implementar Sidebar — estado expandido con accordion
  - Crear `apps/frontend/src/shared/components/sidebar/Sidebar.tsx`
  - Renderizar logo "ARIS" + "SAMI v2" + botón colapsar "«" cuando expandido (~260px)
  - Llamar `getVisibleModules(canAccess)` y renderizar módulos como accordion (solo uno expandido a la vez)
  - Cada módulo muestra: icono, label, chevron (▸/▾); apps expandidas muestran bullet + label
  - App activa recibe: fondo primario sutil, texto primario, borde izquierdo primario
  - Al cargar, auto-expandir el módulo que contiene la ruta activa actual
  - Persistir módulo activo en `localStorage["sami-sidebar-active-module"]` con try/catch
  - Transición accordion: height + opacity, 200ms ease-out
  - Navegar a `app.path` al hacer click en una app
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [ ]* 6.1 Property test P7: el accordion tiene como máximo un módulo expandido
    - **Property 7: accordion has at most one expanded module**
    - **Validates: Requirements 5.3**

  - [ ]* 6.2 Property test P8: localStorage round-trip del módulo activo
    - **Property 8: localStorage round-trip for active module slug**
    - **Validates: Requirements 5.8**

  - [ ]* 6.3 Unit tests para Sidebar expandido
    - Auto-expande el módulo correcto al cargar con ruta activa
    - Persiste slug en localStorage al expandir módulo
    - Solo un módulo expandido tras secuencia de clics
    - _Requirements: 5.3, 5.7, 5.8_

- [ ] 7. Implementar Sidebar — estado colapsado (~64px)
  - Cuando `isCollapsed = true`, mostrar solo iconos de módulos a ~64px de ancho
  - Hover sobre icono de módulo muestra tooltip con el nombre del módulo
  - Click en icono de módulo colapsado abre popover lateral con lista de apps del módulo
  - Animar transición de ancho entre expandido y colapsado: 200ms ease
  - Botón "«" colapsa; botón "»" expande
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 8. Implementar Sidebar — comportamiento mobile (Sheet/Drawer)
  - En viewport < 768px, el Sidebar no ocupa espacio en pantalla por defecto
  - Cuando `isMobileOpen = true`, renderizar Sheet/Drawer desde la izquierda con backdrop semitransparente
  - El Sheet renderiza el mismo accordion del estado expandido
  - Al seleccionar una app en mobile, navegar a `app.path` Y llamar `onMobileClose()`
  - _Requirements: 7.1, 7.3, 7.4, 7.5_

  - [ ]* 8.1 Unit tests para Sidebar mobile
    - Cierra el Sheet automáticamente al navegar a una app
    - _Requirements: 7.5_

- [ ] 9. Implementar SidebarFooter
  - Crear `apps/frontend/src/shared/components/sidebar/SidebarFooter.tsx`
  - Renderizar avatar con iniciales (fondo primario, texto blanco), nombre completo `{firstName} {lastName}` o `workerName`, SAP code
  - Renderizar botón logout con icono `LogOut` que llama `logout.mutate()` de `useLogout()`
  - En estado colapsado, mostrar solo avatar y botón logout (ocultar nombre y SAP code)
  - _Requirements: 8.1, 8.2, 8.4_

- [ ] 10. Implementar Topbar con breadcrumbs dinámicos
  - Crear `apps/frontend/src/shared/components/topbar/Topbar.tsx`
  - Exportar `ROUTE_LABELS` con los 25 mapeos de segmentos a etiquetas en español
  - Botón hamburguesa "☰" visible solo en viewport < 768px (llama `onMobileMenuOpen`)
  - Breadcrumbs construidos con `useMatches()` de TanStack Router, usando `ROUTE_LABELS` para mapear segmentos
  - Todos los segmentos excepto el último renderizan como `<Link>`; el último como texto plano
  - Separador "/" entre segmentos
  - Mostrar nombre del worker y avatar pequeño a la derecha
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 10.1 Property test P6: el mapeo de segmentos cubre todos los slugs del catálogo
    - **Property 6: ROUTE_LABELS covers all slugs with non-empty Spanish labels**
    - **Validates: Requirements 9.4**

  - [ ]* 10.2 Unit tests para Topbar
    - El último breadcrumb se renderiza como texto plano (no Link)
    - _Requirements: 9.5_

- [ ] 11. Fix de sesión — mapeo correcto desde `authRepository.getMe()` / `MeResult`
  - Modificar o crear `apps/frontend/src/shared/hooks/useSession.ts` (o el hook de sesión existente) usando `authRepository.getMe()` y el shape `MeResult` (`sapCode`, `workerName`, `appRoles`, etc.)
  - No asumir `data.worker.*` en JSON crudo: el repositorio ya normaliza snake_case → camelCase
  - `firstName`, `lastName`, `position` en UI: `''` o derivación acordada desde `workerName` hasta ampliar API
  - Verificar que ningún campo renderiza "undefined" en Dashboard, Sidebar ni Topbar
  - Implementar `useLogout()` con `onSuccess` y `onError` ambos ejecutando `queryClient.clear()` + `navigate({ to: '/login' })`
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 11.1 Unit tests para logout
    - Llama `queryClient.clear()` en onSuccess
    - Llama `queryClient.clear()` en onError
    - Navega a `/login` en ambos casos
    - _Requirements: 10.2, 10.3_

- [ ] 12. Checkpoint final — build limpio
  - Ejecutar `pnpm build` y verificar que no hay errores de TypeScript ni de bundling
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requirements específicos para trazabilidad
- Los property tests usan fast-check con mínimo 100 iteraciones (`numRuns: 100`)
- Los unit tests usan Vitest + Testing Library
- NO crear carpetas bajo `apps/frontend/src/modules/` — toda la lógica de placeholder vive en los route files
- El estado `isCollapsed` puede persistirse en `localStorage["sami-sidebar-collapsed"]` si se desea
