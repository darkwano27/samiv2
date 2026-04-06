/** Segmentos de URL → etiqueta en español (breadcrumbs). */
export const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Inicio',
  'mi-firma': 'Mi firma',
  'horas-extra': 'WorkForce',
  'registro-horas-extra': 'Registro de Horas Extra',
  'aprobacion-horas-extra': 'Aprobación de Horas Extra',
  'horas-extra-ajustes': 'Ajustes WorkForce',
  'salud-ocupacional': 'Salud Ocupacional',
  ajustes: 'Ajustes',
  'registro-consulta': 'Registro de Consulta',
  'mis-consultas': 'Mis Consultas',
  'descanso-medico': 'Descanso Médico',
  'inventario-medico': 'Inventario Médico',
  'historial-medico': 'Historial Médico',
  reportes: 'Reportes',
  sistemas: 'Sistemas',
  'asignacion-bienes': 'Asignación de Bienes',
  'registro-productividad': 'Registro de productividad (en pausa)',
  'mis-equipos': 'Mis Equipos',
  'crm-quimicos': 'CRM Químicos',
  'dashboard-crm': 'Dashboard CRM',
  visitas: 'Visitas',
  'registro-visita': 'Registro de Visita',
  'portal-central': 'Portal Central',
  administracion: 'Administración',
  'gestion-usuarios': 'Gestión de Usuarios',
  roles: 'Roles',
  asignaciones: 'Asignaciones',
};

export function labelForSegment(segment: string): string {
  return ROUTE_LABELS[segment] ?? segment;
}
