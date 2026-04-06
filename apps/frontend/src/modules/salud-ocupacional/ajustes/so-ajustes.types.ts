export const SO_AJUSTES_TABS = ['miembros', 'perfiles', 'correo'] as const;
export type SoAjustesTab = (typeof SO_AJUSTES_TABS)[number];

export function isSoAjustesTab(v: unknown): v is SoAjustesTab {
  return typeof v === 'string' && (SO_AJUSTES_TABS as readonly string[]).includes(v);
}
