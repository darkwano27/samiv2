# SAMI v2 — Design system (frontend)

## Viabilidad

- **Stack:** Vite, React, Tailwind CSS v4, componentes estilo **shadcn/ui** (Base UI + tokens en CSS).
- **PWA:** `vite-plugin-pwa` con manifest y actualización automática del service worker; iconos en `public/`; `theme-color` en `index.html`. Para instalación óptima en todos los dispositivos se pueden añadir PNG 192×192 y 512×512 además del SVG.
- **Responsive / mobile-first:** layouts en columna primero; áreas táctiles en acciones principales (`Button` `size="touch"`, altura mínima ~44px).

## Tokens de marca (CSS)

Definidos en `apps/frontend/src/index.css` vía variables (`:root`), alineados al brief:

| Rol        | Valor     |
|-----------|-----------|
| Primary   | `#21A795` |
| Hover     | `#1D9484` (botón default) |
| Background| `#FFFFFF` |
| Surface   | `#F8FAFC` (muted / cards) |
| Text      | `#0F172A` |
| Border    | `#E2E8F0` |

Radio base: **md** (`0.375rem`), sombras ligeras en cards donde aplica el preset shadcn.

## Reglas de UI

- Componentes desde `@/components/ui/*` (no inventar estilos one-off en pantallas salvo excepciones puntuales).
- Espaciado coherente con **múltiplos de 8px** (`gap-2`, `gap-4`, `p-4`, `p-8`, etc.).
- Sin animaciones decorativas globales; en el login, entre pasos, solo una entrada breve (`fade-in` + leve desplazamiento, ~300ms) y `motion-reduce:animate-none`.
- Estados: errores con `text-destructive` y `role="alert"`; loading en botones con texto (“Enviando…”, “Guardando…”).

## Atomic Design (convención en repo)

- **Átomos:** `src/components/ui/` (Button, Input, Label, Card, …).
- **Moléculas / organismos de dominio:** `src/modules/<módulo>/components/` (p. ej. auth: `AuthCard`, pasos de login).
- **Páginas / layouts:** `src/routes/` y shells que componen lo anterior.

## Shell autenticado (dashboard / sidebar)

Implementación alineada a `.kiro/specs/sami-dashboard-sidebar/` (copia en repo). **Detalle UX y decisiones de módulo vs dashboard:** `docs/frontend/shell-navigation-ux.md`.

- **Layout:** `src/routes/_authenticated/route.tsx` — fila `min-h-dvh`: sidebar **altura completa** + columna derecha (cabecera + contenido con scroll). `beforeLoad` con `authRepository.getMe()`, contexto `{ session }`.
- **Sidebar:** `src/shared/components/sidebar/Sidebar.tsx` — fondo **`#00201B`**, texto/iconos claros; **Inicio** (`/dashboard`) como primer ítem; módulos con resalte al seleccionar o si la ruta pertenece al módulo; colapsado ~64px con **popover de apps**; drawer en móvil. Persistencia: `sami-sidebar-active-module`, `sami-sidebar-collapsed`.
- **Cabecera área principal:** `src/shared/components/topbar/authenticated-app-header.tsx` — misma fila: **migas de pan** (scroll horizontal si hace falta) + usuario + iniciales + **Salir** (`useLogout`). Sin usuario en el sidebar.
- **Migas de pan:** `src/shared/components/topbar/content-breadcrumbs.tsx` — en cabecera con `layout="inline"`. Etiquetas: `route-labels.ts`.
- **Scroll global:** el layout autenticado usa `h-dvh overflow-hidden`; solo la columna del `Outlet` hace scroll — el sidebar permanece fijo en altura de viewport.
- **Dashboard:** `src/shared/components/dashboard/Dashboard.tsx` — banner (gradiente `#21a795`), bloques por división/módulo desde `navigation-config.ts`.
- **Catálogo:** `navigation-config.ts` — solo módulos de negocio; Inicio no está en `MODULES` (está fijado en el sidebar).
- **Rutas app:** una ruta por app del catálogo (**17**) bajo `src/routes/_authenticated/**`, más `/dashboard`; `beforeLoad` → `assertAppAccess`. Los datos maestros de trabajadores vienen de **SAP en lectura**; no hay app de “sync” hacia SAMI.
- **Post-login:** `/dashboard`; `/` con sesión → `/dashboard`.
- **Iconos:** `NavIcon.tsx` importa solo iconos usados en el catálogo.

## Login (marca e imagen)

- **Layout:** **desktop** `grid-cols-[11fr_9fr]` (~55/45). **Móvil:** `LoginHeroBackdrop` como `absolute inset-0 z-0` (no `z` negativo: si no, el fondo blanco del padre lo tapa); `main` **transparente** en móvil y `md:bg-background` en desktop.
- **Tarjetas:** `belowHeader` (flecha) **arriba del título** en pasos normales; en `success` queda **esquina superior izquierda** (`absolute`) para no competir con el ícono centrado.
- **Archivos (sin espacios en rutas):** `public/images/fondo-aris.jpg`, `public/brand/logo-aris-negativo.png` — constantes en `login-assets.ts`.
- **Auth multi-paso (spec `.kiro/specs/sami-auth-multistep`):** `StepIdentify` (solo código SAP → `identify`) → `password-ad` | `password-local` | `register` (DNI) → éxito / recuperar / cambio de clave según diagrama. Estilo de plantilla (50/50, marketing, foto) sin alterar esa máquina de estados.

## Referencias

- Login y home deben usar `bg-background`, `text-foreground`, `text-muted-foreground`, `text-primary` en enlaces.
- Añadir nuevos primitives con: `pnpm dlx shadcn@latest add <componente>` desde `apps/frontend`.
