/**
 * Catálogo único de navegación (Dashboard de división/módulo, Sidebar, guards).
 *
 * **Inicio (`/dashboard`)** no forma parte de `MODULES`: el shell lo pinta como primer ítem fijo
 * en `Sidebar.tsx` (enlace directo al tablero general). Aquí solo viven módulos de negocio y sus apps.
 *
 * Spec: `.kiro/specs/sami-dashboard-sidebar/design.md`
 */

export interface NavApp {
  slug: string;
  label: string;
  path: string;
  description: string;
  icon: string;
}

export interface NavModule {
  slug: string;
  label: string;
  icon: string;
  divisionCode: string;
  apps: NavApp[];
}

export interface NavDivision {
  code: string;
  label: string;
  modules: string[];
}

export const DIVISIONS: NavDivision[] = [
  { code: 'AR10', label: 'Textil', modules: [] },
  { code: 'AR20', label: 'Cerámicos', modules: [] },
  { code: 'AR30', label: 'Químicos', modules: [] },
  { code: 'AR40', label: 'Agropunto', modules: [] },
  { code: 'AR50', label: 'Trade Agrícola', modules: [] },
  {
    code: 'AR80',
    label: 'Operaciones',
    modules: ['salud-ocupacional', 'horas-extra'],
  },
  {
    code: 'AR90',
    label: 'Administración y Finanzas',
    modules: ['sistemas', 'administracion'],
  },
];

export const MODULES: NavModule[] = [
  {
    slug: 'horas-extra',
    label: 'WorkForce',
    icon: 'Clock',
    divisionCode: 'AR80',
    apps: [
      {
        slug: 'registro-horas-extra',
        label: 'Registro de Horas Extra',
        path: '/horas-extra/registro-horas-extra',
        description: 'Registra las horas extra trabajadas',
        icon: 'FileClock',
      },
      {
        slug: 'aprobacion-horas-extra',
        label: 'Aprobación de Horas Extra',
        path: '/horas-extra/aprobacion-horas-extra',
        description: 'Bandeja y aprobación de boletas',
        icon: 'ClipboardCheck',
      },
      {
        slug: 'horas-extra-ajustes',
        label: 'Ajustes',
        path: '/horas-extra/ajustes',
        description: 'Organización ARIS, miembros, correo y directorio',
        icon: 'Settings',
      },
    ],
  },
  {
    slug: 'salud-ocupacional',
    label: 'Salud Ocupacional',
    icon: 'Heart',
    divisionCode: 'AR80',
    apps: [
      {
        slug: 'registro-consulta',
        label: 'Registro de Consulta',
        path: '/salud-ocupacional/registro-consulta',
        description: 'Registra consultas médicas',
        icon: 'Stethoscope',
      },
      {
        slug: 'mis-consultas',
        label: 'Mis Consultas',
        path: '/salud-ocupacional/mis-consultas',
        description: 'Historial de consultas del worker',
        icon: 'ClipboardList',
      },
      {
        slug: 'inventario-medico',
        label: 'Inventario Médico',
        path: '/salud-ocupacional/inventario-medico',
        description: 'Control de inventario médico',
        icon: 'Pill',
      },
      {
        slug: 'historial-medico',
        label: 'Historial Médico',
        path: '/salud-ocupacional/historial-medico',
        description: 'Historial médico del worker',
        icon: 'FileHeart',
      },
      /**
       * UI &quot;Ajustes&quot;: acceso vía `managed_module_slugs` o rol en apps del módulo.
       * Catálogo RBAC: `salud-ocupacional-gestion` (app de gestión del módulo).
       */
      {
        slug: 'salud-ocupacional-ajustes',
        label: 'Ajustes',
        path: '/salud-ocupacional/ajustes',
        description: 'Roles del módulo y configuración de correo (administración)',
        icon: 'Settings',
      },
    ],
  },
  {
    slug: 'sistemas',
    label: 'Sistemas',
    icon: 'Monitor',
    divisionCode: 'AR90',
    apps: [
      {
        slug: 'mis-equipos',
        label: 'Mis Equipos',
        path: '/sistemas/mis-equipos',
        description: 'Equipos asignados al worker',
        icon: 'PackageCheck',
      },
      {
        slug: 'asignacion-bienes',
        label: 'Asignación de Bienes',
        path: '/sistemas/asignacion-bienes',
        description: 'Gestión de asignación de bienes',
        icon: 'Laptop',
      },
      {
        slug: 'sistemas-ajustes',
        label: 'Ajustes',
        path: '/sistemas/ajustes',
        description: 'Roles del módulo y configuración de correo (administración)',
        icon: 'Settings',
      },
    ],
  },
  {
    slug: 'administracion',
    label: 'Administración',
    icon: 'Settings',
    divisionCode: 'AR90',
    apps: [
      {
        slug: 'gestion-usuarios',
        label: 'Gestión de Usuarios',
        path: '/administracion/gestion-usuarios',
        description: 'Administración de usuarios del sistema',
        icon: 'Users',
      },
      {
        slug: 'administracion-ajustes',
        label: 'Ajustes',
        path: '/administracion/ajustes',
        description: 'SMTP del sistema y ajustes globales',
        icon: 'Mail',
      },
    ],
  },
];

export type ResolvedModule = NavModule & { visibleApps: NavApp[] };
export type ResolvedDivision = NavDivision & { resolvedModules: ResolvedModule[] };

/** Slug de módulo (`NavModule.slug`) para una app del catálogo de navegación, p. ej. `registro-consulta` → `salud-ocupacional`. */
export function getModuleSlugForNavApp(navAppSlug: string): string | null {
  for (const m of MODULES) {
    if (m.apps.some((a) => a.slug === navAppSlug)) return m.slug;
  }
  return null;
}

export function getDivisionsWithModules(
  canAccess: (appSlug: string) => boolean,
): ResolvedDivision[] {
  return DIVISIONS.flatMap((division) => {
    const resolvedModules = division.modules.flatMap((moduleSlug) => {
      const mod = MODULES.find((m) => m.slug === moduleSlug);
      if (!mod) return [];
      const visibleApps = mod.apps.filter((app) => canAccess(app.slug));
      if (visibleApps.length === 0) return [];
      return [{ ...mod, visibleApps }];
    });
    if (resolvedModules.length === 0) return [];
    return [{ ...division, resolvedModules }];
  });
}

export function getVisibleModules(
  canAccess: (appSlug: string) => boolean,
): ResolvedModule[] {
  return MODULES.flatMap((mod) => {
    const visibleApps = mod.apps.filter((app) => canAccess(app.slug));
    if (visibleApps.length === 0) return [];
    return [{ ...mod, visibleApps }];
  });
}
