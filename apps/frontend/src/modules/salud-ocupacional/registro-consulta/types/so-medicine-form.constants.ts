/** Alineado a `createMedicineBodySchema` del backend. */
export const SO_MEDICINE_PRESENTATIONS = [
  'Tableta',
  'Cápsula',
  'Ampolla',
  'Frasco',
  'Jarabe',
  'Crema',
  'Gel',
  'Gotas',
  'Supositorio',
  'Parche',
  'Inhalador',
  'Solución',
  'Suspensión',
  'Polvo',
  'Material',
  'Sobre',
  'Aerosol',
] as const;

export const SO_MEDICINE_ADMIN_ROUTES = [
  'Oral (VO)',
  'Intramuscular (IM)',
  'Intravenosa (IV)',
  'Subcutánea (SC)',
  'Tópica',
  'Sublingual',
  'Rectal',
  'Inhalatoria',
  'Oftálmica',
  'Ótica',
  'Nasal',
  'No aplica',
] as const;

export const SO_MEDICINE_INVENTORY_UNITS = [
  'tableta',
  'cápsula',
  'ampolla',
  'frasco',
  'sobre',
  'tubo',
  'unidad',
] as const;

export type SoMedicinePresentation = (typeof SO_MEDICINE_PRESENTATIONS)[number];
export type SoMedicineAdminRoute = (typeof SO_MEDICINE_ADMIN_ROUTES)[number];
export type SoMedicineInventoryUnit = (typeof SO_MEDICINE_INVENTORY_UNITS)[number];
