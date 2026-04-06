export const WORKFORCE_AJUSTES_TABS = [
  'organizacion',
  'roles',
  'correo',
  'conexion',
] as const;

export type WorkforceAjustesTab = (typeof WORKFORCE_AJUSTES_TABS)[number];

export function isWorkforceAjustesTab(v: unknown): v is WorkforceAjustesTab {
  return typeof v === 'string' && (WORKFORCE_AJUSTES_TABS as readonly string[]).includes(v);
}
