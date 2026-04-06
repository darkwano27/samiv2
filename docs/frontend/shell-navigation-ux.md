# Shell autenticado — UX de navegación

Documento de referencia para layout, colores y decisión de interacción **módulo → apps vs dashboard del módulo**.

## Layout actual (implementado)

| Zona | Comportamiento |
|------|----------------|
| **Sidebar** | Altura **viewport completa** (`h-dvh`), fondo **`#00201B`**, texto claro e iconos en tonos turquesa (`#5EEAD4`, `#D1FAE5`). Borde derecho `border-white/10`. |
| **Primer ítem** | **Inicio** → `/dashboard` (no sale de `MODULES` en `navigation-config.ts`; está anclado en `Sidebar.tsx`). |
| **Módulos** | Accordion: un módulo expandido a la vez; filas resaltadas si están abiertas o si la ruta actual es una app de ese módulo (sombreado + acento vertical `#2DD4BF`). |
| **Sidebar colapsado** | Iconos; al pulsar un módulo se abre **`CollapsedModuleFlyout`** (portal a `body`, lista de apps, sin recorte por `overflow`). |
| **Cabecera principal** | Una fila: **migas** (centro, `layout="inline"`, scroll horizontal en móvil) + usuario + **Salir** (`AuthenticatedAppHeader`). |
| **Scroll** | Raíz `h-dvh overflow-hidden`; solo el `<Outlet />` hace scroll vertical — el sidebar queda fijo en altura de viewport. |
| **Drawer móvil** | Siempre muestra **texto** de módulos y apps (`compactNav` forzado a falso en sheet). |

Archivos clave:

- `apps/frontend/src/routes/_authenticated/route.tsx` — estructura flex `sidebar | (header + contenido)`.
- `apps/frontend/src/shared/components/sidebar/Sidebar.tsx` — estilos y lógica lateral.
- `apps/frontend/src/shared/components/topbar/authenticated-app-header.tsx` — migas + usuario + Salir.
- `apps/frontend/src/shared/components/topbar/content-breadcrumbs.tsx` — migas (`layout="inline"` en cabecera).
- `apps/frontend/src/shared/components/sidebar/collapsed-module-flyout.tsx` — menú flotante colapsado (portal).

## Análisis: ¿al hacer clic en un módulo, dashboard propio, solo lista/combo, o ambos?

### Opción A — Solo lista de aplicaciones (patrón actual)

- **Ventaja:** Escaneo rápido de todas las apps del módulo; encaja con muchas entradas de menú; implementación simple (accordion + enlaces).
- **Inconveniente:** No hay “resumen” del módulo en una sola pantalla.

### Opción B — Solo landing/dashboard por módulo

- **Ventaja:** KPIs, avisos y accesos destacados por área de negocio.
- **Inconveniente:** Cuesta una ruta y diseño por módulo; el usuario hace **un clic extra** para llegar a una app concreta si no hay atajos.

### Opción C — Híbrido (recomendación de producto a medio plazo)

1. Mantener la **lista de apps** siempre visible al expandir el módulo (o en popover si está colapsado) — es la forma más directa de trabajar día a día.
2. Añadir, cuando el negocio lo defina, una ruta opcional tipo **`/salud-ocupacional`** (index del módulo) con **resumen + mismos enlaces** a apps. El ítem del módulo podría ser: clic en el **nombre** → resumen; clic en **chevron** → expandir solo lista — o un enlace “Ver resumen” dentro del panel.

**Estado en código hoy:** Opción A + **Inicio** global en `/dashboard`. La opción C se puede introducir sin romper el catálogo: nuevas rutas layout por carpeta y un ítem extra en el accordion o un `Link` “Resumen” en la cabecera del módulo.

### ¿Un combo box en lugar del accordion?

Un **select** compacta espacio pero **oculta** las apps hasta abrir el desplegable y es peor en accesibilidad y descubribilidad que una lista vertical. Tiene sentido solo en UIs muy densas (p. ej. toolbar). Para SAMI, la lista/accordion + popover en colapsado es más adecuada.

## Cierre de sesión

`useLogout` (`apps/frontend/src/modules/auth/hooks/use-logout.ts`) limpia React Query y navega a `/login` al terminar la mutación (éxito o error). El botón **Salir** vive solo en la cabecera principal, no en el sidebar.
