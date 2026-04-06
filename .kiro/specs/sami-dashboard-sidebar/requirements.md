# Requirements Document — SAMI Dashboard & Sidebar

> **Copia de trabajo** en el monorepo `sami-V2`. Rutas de código: `apps/frontend/src/…`.

## Introduction

SAMI v2 requiere un Dashboard principal y un Sidebar de navegación que permitan a los workers acceder a las apps disponibles según su perfil RBAC. El Dashboard organiza el acceso por División → Módulo → App, mientras que el Sidebar organiza por Módulo → App (sin divisiones). Ambos componentes filtran el contenido según los permisos del worker autenticado y se integran con TanStack Router para la navegación file-based. El sistema incluye además una Topbar con breadcrumbs dinámicos y 20 route files placeholder para todas las apps del catálogo.

**Alineación con specs anteriores:** la sesión usa cookie HttpOnly `sami_session` + Redis con payload `{ sapCode, workerName }`. Los permisos se resuelven vía `canAccessApp()` en `apps/frontend/src/infrastructure/auth/permissions.ts` con `RBAC_ENABLED=false` en esta fase. El identificador del worker es `sap_code` / `workers.id` (TEXT). Las rutas son file-based con TanStack Router bajo `apps/frontend/src/routes/_authenticated/`. El shape de `GET auth/me` en frontend es `MeResult` (`sapCode`, `workerName`, `appRoles[]` como objetos); ver `design.md` — `firstName` / `lastName` / `position` en UI son opcionales hasta ampliar API o derivar de `worker_name`.

---

## Glossary

- **Dashboard**: Página principal de SAMI v2 que muestra las apps disponibles agrupadas por División y Módulo.
- **Sidebar**: Panel de navegación lateral que muestra los módulos y apps disponibles agrupados por Módulo (sin divisiones).
- **Topbar**: Barra superior con botón hamburguesa (mobile), breadcrumbs y datos del worker.
- **División**: Estructura organizacional SAP que agrupa módulos (ej: AR80 Operaciones). Código SAP de 4 caracteres.
- **Módulo**: Agrupación de apps por capacidad de negocio (ej: Salud Ocupacional). Identificado por slug.
- **App**: Unidad funcional de SAMI, target de RBAC (ej: Registro de Consulta). Identificada por slug.
- **NavApp**: Interfaz TypeScript que describe una app navegable: `{ slug, label, path, description, icon }`.
- **NavModule**: Interfaz TypeScript que describe un módulo navegable: `{ slug, label, icon, divisionCode, apps: NavApp[] }`.
- **NavDivision**: Interfaz TypeScript que describe una división navegable: `{ code, label, modules: string[] }`.
- **Navigation_Config**: Archivo `apps/frontend/src/shared/components/sidebar/navigation-config.ts` que define el catálogo completo de divisiones, módulos y apps con sus metadatos.
- **Route_File**: Archivo de ruta TanStack Router bajo `apps/frontend/src/routes/_authenticated/` que define un componente placeholder y su guard de acceso.
- **Session**: Objeto de sesión del worker vía `useSession()` / `authRepository.getMe()`: al menos `sapCode`, `workerName`, `isSuperadmin`, roles de app; opcionalmente `firstName`, `lastName`, `position` para saludos e iniciales cuando existan o se deriven.
- **Permission_Helper**: Función `canAccessApp(session, appSlug)` en `apps/frontend/src/infrastructure/auth/permissions.ts`.
- **Accordion**: Componente de navegación en el Sidebar donde solo un módulo puede estar expandido a la vez.
- **Sheet**: Componente drawer/panel lateral que se abre desde la izquierda en mobile.
- **Breadcrumb**: Elemento de navegación que muestra la ruta actual en formato "Inicio / Módulo / App".
- **Worker**: Empleado autenticado en SAMI identificado por `sap_code`.

---

## Requirements

### Requirement 1: Navigation Config — Interfaces y catálogo

**User Story:** As a frontend developer, I want a centralized navigation configuration file, so that all components (Dashboard, Sidebar, Topbar) share a single source of truth for the app catalog.

#### Acceptance Criteria

1. THE Navigation_Config SHALL define the `NavApp` TypeScript interface with fields: `slug` (string), `label` (string), `path` (string), `description` (string), `icon` (string — nombre de icono lucide-react).
2. THE Navigation_Config SHALL define the `NavModule` TypeScript interface with fields: `slug` (string), `label` (string), `icon` (string), `divisionCode` (string), `apps` (NavApp[]).
3. THE Navigation_Config SHALL define the `NavDivision` TypeScript interface with fields: `code` (string), `label` (string), `modules` (string[] — slugs de módulos).
4. THE Navigation_Config SHALL define the following 7 divisiones SAP: `AR10` (Textil, sin módulos), `AR20` (Cerámicos, sin módulos), `AR30` (Químicos, módulos: `crm-quimicos`), `AR40` (Agropunto, sin módulos), `AR50` (Trade Agrícola, sin módulos), `AR80` (Operaciones, módulos: `salud-ocupacional`, `horas-extra`, `visitas`), `AR90` (Administración y Finanzas, módulos: `sistemas`, `administracion`).
5. THE Navigation_Config SHALL define los siguientes 6 módulos con sus apps, iconos lucide-react y divisionCode: `horas-extra` (Clock, AR80) con apps `registro-horas-extra` (FileClock) y `gestion-roles-he` (UserCog); `salud-ocupacional` (Heart, AR80) con apps `registro-consulta` (Stethoscope), `mis-consultas` (ClipboardList), `descanso-medico` (BedDouble), `inventario-medico` (Pill), `historial-medico` (FileHeart), `reportes-so` (BarChart3); `visitas` (DoorOpen, AR80) con apps `registro-visita` (UserPlus) y `portal-central` (Globe); `crm-quimicos` (FlaskConical, AR30) con app `dashboard-crm` (LayoutDashboard); `sistemas` (Monitor, AR90) con apps `asignacion-bienes` (Laptop), `registro-productividad` (TrendingUp), `mis-equipos` (PackageCheck); `administracion` (Settings, AR90) con apps `gestion-usuarios` (Users), `roles` (Shield), `asignaciones` (Link). No hay app de sincronización masiva con SAP: los datos maestros se consultan en lectura desde SAP cuando aplica.
6. THE Navigation_Config SHALL export a helper function `getDivisionsWithModules(canAccess: (appSlug: string) => boolean)` que retorna las divisiones con sus módulos y apps filtrados por permisos, excluyendo divisiones cuyo resultado no contenga ningún módulo visible.
7. THE Navigation_Config SHALL export a helper function `getVisibleModules(canAccess: (appSlug: string) => boolean)` que retorna los módulos con sus apps filtradas por permisos, sin agrupar por división.
8. WHEN `getDivisionsWithModules` is called, THE Navigation_Config SHALL exclude any División that has no modules with at least one accessible app after filtering.
9. WHEN `getVisibleModules` is called, THE Navigation_Config SHALL exclude any Módulo that has no accessible apps after filtering.

---

### Requirement 2: Route Files — Placeholders autenticados

**User Story:** As a frontend developer, I want thin route files for all 17 apps de negocio, so that TanStack Router generates the route tree automatically and each route enforces access control.

#### Acceptance Criteria

1. THE Route_File for each app SHALL export a component that renders: un `<h1>` con el nombre de la app, una descripción breve, y el texto "Módulo en desarrollo".
2. THE Route_File for each app SHALL define a `beforeLoad` function that calls `canAccessApp(context.session!, appSlug)` and redirects to `/dashboard` if the worker does not have access.
3. THE Route_File SHALL use `createFileRoute` with the correct path matching the file location under `apps/frontend/src/routes/_authenticated/`.
4. THE Navigation_Config SHALL define paths for all 17 apps matching the following structure: `horas-extra/registro-horas-extra`, `horas-extra/gestion-roles-he`, `salud-ocupacional/registro-consulta`, `salud-ocupacional/mis-consultas`, `salud-ocupacional/descanso-medico`, `salud-ocupacional/inventario-medico`, `salud-ocupacional/historial-medico`, `salud-ocupacional/reportes`, `sistemas/asignacion-bienes`, `sistemas/registro-productividad`, `sistemas/mis-equipos`, `crm-quimicos/dashboard-crm`, `visitas/registro-visita`, `visitas/portal-central`, `administracion/gestion-usuarios`, `administracion/roles`, `administracion/asignaciones`.
5. THE Route_File SHALL NOT create any folders under `apps/frontend/src/modules/` — toda la lógica de placeholder vive en el route file.
6. WHEN a worker without access attempts to navigate to a protected route, THE Route_File SHALL redirect the worker to `/dashboard` via TanStack Router's `redirect` utility.

---

### Requirement 3: Dashboard — Banner de bienvenida

**User Story:** As a worker, I want a personalized welcome banner on the dashboard, so that I can see my identity and role at a glance when I log in.

#### Acceptance Criteria

1. THE Dashboard SHALL render a banner with a gradient background from `#21a795` (dark left) to a lighter variant (right) with white text.
2. THE Dashboard SHALL display a dynamic greeting: "Buenos días" (5:00–11:59), "Buenas tardes" (12:00–17:59), or "Buenas noches" (18:00–4:59), followed by the worker's `firstName` when available; IF `firstName` is empty, THE Dashboard SHALL use the first token of `workerName` or `workerName` completo as agreed with product.
3. THE Dashboard SHALL display the worker's `position` (cargo/puesto) as subtitle IF the session contains a non-empty `position` value; OTHERWISE THE Dashboard SHALL display "SAMI - Sistema Administrativo Modular Integrado".
4. THE Dashboard SHALL display an avatar with the worker's initials on the right side of the banner, with a semi-transparent white background.
5. THE Dashboard SHALL display "Código: {sapCode}" below the worker's name in the banner.
6. WHEN the session returns `undefined` or empty values for worker fields, THE Dashboard SHALL display fallback text instead of "undefined" by checking the field mapping from `GET /api/auth/me` response.

---

### Requirement 4: Dashboard — Sección de módulos por división

**User Story:** As a worker, I want to see my available apps organized by division and module on the dashboard, so that I can quickly navigate to the tools I need.

#### Acceptance Criteria

1. THE Dashboard SHALL display a subtitle: "Acceso directo a las apps y funciones disponibles para tu perfil" above the divisions section.
2. THE Dashboard SHALL call `getDivisionsWithModules(canAccess)` to obtain the filtered list of divisions and SHALL NOT render divisions with no visible modules.
3. THE Dashboard SHALL render each visible División as a card/container with a subtle border and `bg-muted/30` background.
4. THE Dashboard SHALL render each División header with: a badge showing the SAP code (ej: "AR80") in primary color, and the division name in uppercase bold.
5. THE Dashboard SHALL render each Módulo within a División as a column with: the module name in uppercase, primary color, `font-semibold`, `text-sm`; and its apps listed vertically below.
6. THE Dashboard SHALL render each App within a module with: a circular icon with subtle primary background, the app name in bold, and the app description in `text-sm muted`.
7. WHEN a worker clicks an App card, THE Dashboard SHALL navigate to `app.path` using TanStack Router.
8. THE Dashboard SHALL apply a subtle highlight background on App hover.
9. THE Dashboard SHALL use a responsive layout: up to 3 columns on desktop (≥1024px), 2 columns on tablet (768px–1023px), 1 column on mobile (<768px).
10. WHEN a División contains exactly 1 visible Módulo, THE Dashboard SHALL render that module's column at full width.

---

### Requirement 5: Sidebar — Estado expandido

**User Story:** As a worker, I want a sidebar that shows my available modules and apps with smooth accordion navigation, so that I can navigate the system efficiently.

#### Acceptance Criteria

1. THE Sidebar SHALL display a logo area with "ARIS" logo, "SAMI v2" text, and a collapse button labeled "«" when expanded.
2. THE Sidebar SHALL call `getVisibleModules(canAccess)` to obtain the filtered list of modules and SHALL NOT render modules with no accessible apps.
3. THE Sidebar SHALL render modules as an accordion where only ONE module can be expanded at a time.
4. THE Sidebar SHALL render each module item with: the module icon, the module label, and a chevron indicator (▸ when closed, ▾ when open).
5. THE Sidebar SHALL render the apps of an expanded module as a vertical list with a bullet/dot indicator and the app label.
6. WHEN an App is the currently active route, THE Sidebar SHALL apply: subtle primary background, primary text color, and a left border in primary color to that app item.
7. WHEN the Sidebar loads, THE Sidebar SHALL auto-expand the module that contains the currently active app.
8. THE Sidebar SHALL persist the currently expanded module slug in `localStorage` under the key `"sami-sidebar-active-module"`.
9. THE Sidebar SHALL apply smooth transitions on accordion open/close: height + opacity animation, 200ms ease-out.
10. WHEN a worker clicks an App in the Sidebar, THE Sidebar SHALL navigate to the app's path using TanStack Router.

---

### Requirement 6: Sidebar — Estado colapsado

**User Story:** As a worker, I want to collapse the sidebar to icons-only mode, so that I have more screen space when working within an app.

#### Acceptance Criteria

1. WHEN the Sidebar is collapsed, THE Sidebar SHALL display only module icons at approximately 64px width.
2. WHEN a worker hovers over a module icon in collapsed state, THE Sidebar SHALL display a tooltip with the module name.
3. WHEN a worker clicks a module icon in collapsed state, THE Sidebar SHALL display a lateral popover with the list of apps for that module.
4. THE Sidebar SHALL animate the width transition between expanded and collapsed states over 200ms ease.
5. WHEN the collapse button "«" is clicked, THE Sidebar SHALL transition to collapsed state; WHEN the expand action is triggered, THE Sidebar SHALL transition back to expanded state.

---

### Requirement 7: Sidebar — Comportamiento mobile

**User Story:** As a worker on a mobile device, I want a hidden sidebar that opens as a drawer, so that the full screen is available for content on small screens.

#### Acceptance Criteria

1. WHILE the viewport width is less than 768px, THE Sidebar SHALL be hidden by default and not occupy any screen space.
2. WHILE the viewport width is less than 768px, THE Topbar SHALL display a hamburger button "☰" on the left side.
3. WHEN the hamburger button is clicked, THE Sidebar SHALL open as a Sheet/Drawer from the left side with a semi-transparent backdrop.
4. WHILE the Sheet is open on mobile, THE Sidebar SHALL render the same accordion behavior as the expanded desktop sidebar.
5. WHEN a worker selects an App from the mobile Sheet, THE Sidebar SHALL navigate to the app's path AND automatically close the Sheet.

---

### Requirement 8: Sidebar — Footer

**User Story:** As a worker, I want to see my identity and a logout button at the bottom of the sidebar, so that I can identify myself and sign out from any page.

#### Acceptance Criteria

1. THE Sidebar footer SHALL display: an avatar with the worker's initials (primary background, white text), the worker's full name (`{firstName} {lastName}` trimmed, or `workerName` if first/last are not available), and the worker's SAP code.
2. THE Sidebar footer SHALL display a logout button with a `LogOut` icon that calls `logout.mutate()` from the `useLogout()` hook.
3. WHEN the logout action completes (onSuccess OR onError), THE Sidebar SHALL call `queryClient.clear()` and navigate to `/login` via TanStack Router.
4. WHEN the Sidebar is in collapsed state, THE Sidebar footer SHALL display only the avatar and the logout button (hiding the name and SAP code).

---

### Requirement 9: Topbar — Estructura y breadcrumbs

**User Story:** As a worker, I want a topbar with breadcrumbs that reflect my current location, so that I always know where I am in the application.

#### Acceptance Criteria

1. THE Topbar SHALL display on the left: a hamburger button "☰" visible ONLY when viewport width is less than 768px.
2. THE Topbar SHALL display in the center: breadcrumbs built from `useMatches()` of TanStack Router.
3. THE Topbar SHALL display on the right: the worker's name and a small avatar.
4. THE Topbar SHALL map route path segments to Spanish labels for all routes: `dashboard` → "Inicio", `horas-extra` → "Horas Extra", `registro-horas-extra` → "Registro de Horas Extra", `gestion-roles-he` → "Gestión de Roles HE", `salud-ocupacional` → "Salud Ocupacional", `registro-consulta` → "Registro de Consulta", `mis-consultas` → "Mis Consultas", `descanso-medico` → "Descanso Médico", `inventario-medico` → "Inventario Médico", `historial-medico` → "Historial Médico", `reportes` → "Reportes", `sistemas` → "Sistemas", `asignacion-bienes` → "Asignación de Bienes", `registro-productividad` → "Registro de Productividad", `mis-equipos` → "Mis Equipos", `crm-quimicos` → "CRM Químicos", `dashboard-crm` → "Dashboard CRM", `visitas` → "Visitas", `registro-visita` → "Registro de Visita", `portal-central` → "Portal Central", `administracion` → "Administración", `gestion-usuarios` → "Gestión de Usuarios", `roles` → "Roles", `asignaciones` → "Asignaciones".
5. THE Topbar SHALL render each breadcrumb segment as a `Link` component EXCEPT the last segment, which SHALL be rendered as plain text.
6. THE Topbar SHALL format breadcrumbs as "Inicio / Módulo / App" using "/" as separator.

---

### Requirement 10: Fixes de sesión y logout

**User Story:** As a worker, I want the session data to display correctly and logout to work reliably, so that I never see "undefined" in the UI and can always sign out.

#### Acceptance Criteria

1. WHEN the session hook returns worker data, THE Dashboard SHALL map fields from the `GET /api/auth/me` response correctly, comparing the actual response shape with the `getSession()` repository mapping to resolve any field name mismatches WITHOUT modifying the backend.
2. WHEN the logout mutation completes with onSuccess, THE Sidebar SHALL call `queryClient.clear()` and navigate to `/login`.
3. WHEN the logout mutation completes with onError, THE Sidebar SHALL also call `queryClient.clear()` and navigate to `/login`.
4. THE Dashboard SHALL display "SAMI v2" (not "SAMI v3" or any other version) in all text references to the system name.
