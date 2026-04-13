/** Catálogo alineado a `REGISTRO_HE_MOTIVOS` en backend (etiquetas solo lectura, sin llamada API). */
const BY_CODE: Record<string, string> = {
  '01': '01 A-Necesidad de Producción',
  '02': '02 B-Inasistencia Personal',
  '03': '03 C-Enferm. de Personal',
  '04': '04 D-Vacac.de Personal',
  '05': '05 E-',
  '06': '06 F-Descan. de Personal',
  '07': '07 G-Repar. Mex/Elec',
  '08': '08 H-Falta tomar pers.',
  '09': '09 I-Otros',
  '10': '10 J-Feriados',
  '11': '11 K-Capacitación',
  '12': '12 L-Compra de Vacaciones',
};

export function heMotivoLabel(code: string | null | undefined): string {
  const c = (code ?? '').trim();
  if (!c) return '—';
  return BY_CODE[c] ?? c;
}
