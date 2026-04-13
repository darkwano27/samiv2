/**
 * Divisiones ARIS mostradas en Ajustes WorkForce (catálogo + acordeón).
 * Cada grupo puede agrupar varios códigos `werks` del maestro SAP.
 */
export const ARIS_WORKFORCE_DIVISION_GROUPS = [
  {
    slug: 'textil',
    label: 'TEXTIL',
    werks: ['AR10'],
  },
  {
    slug: 'operaciones',
    label: 'OPERACIONES',
    werks: ['AR80'],
  },
  {
    slug: 'administracion-finanzas',
    label: 'ADMINISTRACIÓN Y FINANZAS',
    werks: ['AR90'],
  },
  {
    slug: 'ceramicos',
    label: 'CERÁMICOS',
    werks: ['AR20'],
  },
  {
    slug: 'quimicos',
    label: 'QUÍMICOS',
    werks: ['AR30'],
  },
] as const;

export type ArisDivisionGroupSlug = (typeof ARIS_WORKFORCE_DIVISION_GROUPS)[number]['slug'];

export const MODULE_SLUG_HORAS_EXTRA = 'horas-extra';

/** Perfiles semilla `seed:rbac` — alineados a columnas Organización (supervisor / aprobador). */
export const WORKFORCE_PROFILE_SUPERVISOR_HE = 'supervisor-he';
export const WORKFORCE_PROFILE_APROBADOR_HE = 'aprobador-he';
