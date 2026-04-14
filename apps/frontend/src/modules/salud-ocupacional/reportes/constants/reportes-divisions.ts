import { DIVISIONS } from '@/shared/components/sidebar/navigation-config';

/** Divisiones disponibles en reportes SO (excluye AR40/AR50 por acuerdo operativo). */
const EXCLUDED = new Set(['AR40', 'AR50']);

export const REPORTES_DIVISION_OPTIONS = DIVISIONS.filter((d) => !EXCLUDED.has(d.code));
