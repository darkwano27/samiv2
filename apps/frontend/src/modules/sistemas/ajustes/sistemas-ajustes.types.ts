export const SISTEMAS_AJUSTES_TABS = [
  'miembros',
  'perfiles',
  'correo',
  'glpi',
  'sharepoint',
] as const;

export type SistemasAjustesTab = (typeof SISTEMAS_AJUSTES_TABS)[number];

export function isSistemasAjustesTab(v: unknown): v is SistemasAjustesTab {
  return typeof v === 'string' && (SISTEMAS_AJUSTES_TABS as readonly string[]).includes(v);
}
