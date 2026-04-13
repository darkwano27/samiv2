import { parseFlexibleDateToIso } from './registro-he-dates';

export type PastedRowPartial = {
  pernr: string;
  validFrom: string;
  validTo: string;
  days: number;
  timeStart: string;
  timeEnd: string;
  motivoCode: string;
  observaciones: string;
};

/** Código SAP numérico típico (réplica pernr). */
function looksLikeSapCode(s: string): boolean {
  return /^\d{3,12}$/.test(s.trim());
}

function emptyPastedRow(pernr: string): PastedRowPartial {
  return {
    pernr: pernr.trim(),
    validFrom: '',
    validTo: '',
    days: 1,
    timeStart: '08:00',
    timeEnd: '18:00',
    motivoCode: '',
    observaciones: '',
  };
}

/** Convierte celda de motivo a código `01`…`12` (número, letra A–L, o texto tipo "01 A-..."). */
export function parseMotivoCellToCode(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const num = /^(\d{1,2})\b/.exec(t);
  if (num) {
    const n = Math.min(12, Math.max(1, parseInt(num[1]!, 10)));
    return String(n).padStart(2, '0');
  }
  const letter = t.charAt(0).toUpperCase();
  const idx = 'ABCDEFGHIJKL'.indexOf(letter);
  if (idx >= 0) return String(idx + 1).padStart(2, '0');
  return '';
}

function lineLooksLikeFullDataRow(line: string): boolean {
  const cells = line.split('\t').map((c) => c.trim());
  if (cells.length < 2) return false;
  const c1 = cells[1] ?? '';
  if (parseFlexibleDateToIso(c1)) return true;
  if (/^\d{1,2}:\d{2}$/.test(cells[4] ?? '')) return true;
  if (/^\d{1,2}:\d{2}$/.test(cells[5] ?? '')) return true;
  return false;
}

/**
 * Orden de columnas (TSV desde Excel): SAP | válido de | válido a | días | h.inicio | h.fin | motivo | observaciones.
 * Motivo: número 01–12, letra A–L, o texto que empiece por el número.
 */
export function parseHeExcelTsv(raw: string): { rows: PastedRowPartial[]; errors: string[] } {
  const errors: string[] = [];
  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows: [], errors: ['No hay datos en el portapapeles. Copiá de nuevo desde Excel.'] };
  }

  const rows: PastedRowPartial[] = [];
  let startIdx = 0;
  const firstCells = lines[0]!.split('\t');
  if (firstCells.length >= 1 && firstCells[0] && !/^\d+$/.test(firstCells[0]!.trim())) {
    startIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const cells = lines[i]!.split('\t');
    const pernr = (cells[0] ?? '').trim();
    if (!pernr) {
      errors.push(`Fila ${i + 1}: falta el código SAP.`);
      continue;
    }

    const vf = (cells[1] ?? '').trim();
    const vt = (cells[2] ?? '').trim();
    const isoFrom = vf ? parseFlexibleDateToIso(vf) : null;
    const isoTo = vt ? parseFlexibleDateToIso(vt) : null;
    if (vf && !isoFrom) errors.push(`Fila ${i + 1}: la fecha "desde" no se entendió (${vf}).`);
    if (vt && !isoTo) errors.push(`Fila ${i + 1}: la fecha "hasta" no se entendió (${vt}).`);

    const daysRaw = (cells[3] ?? '1').trim();
    const days = Math.max(1, parseInt(daysRaw, 10) || 1);

    const timeStart = (cells[4] ?? '').trim() || '08:00';
    const timeEnd = (cells[5] ?? '').trim() || '18:00';
    const motivoCode = parseMotivoCellToCode(cells[6] ?? '');
    const observaciones = (cells[7] ?? '').trim();

    const padHm = (t: string, fallback: string) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
      if (!m) return fallback;
      return `${m[1]!.padStart(2, '0')}:${m[2]}`;
    };

    rows.push({
      pernr,
      validFrom: isoFrom ?? '',
      validTo: isoTo ?? '',
      days,
      timeStart: padHm(timeStart, '08:00'),
      timeEnd: padHm(timeEnd, '18:00'),
      motivoCode,
      observaciones,
    });
  }

  return { rows, errors };
}

/**
 * Unifica el pegado desde Excel:
 * - **Una fila** con muchos códigos (celdas en horizontal, separados por tabulador).
 * - **Una columna** de códigos (una fila por persona).
 * - **Tabla completa** con fechas / horas / motivo (mismo formato que antes).
 */
export function parseHePasteToRows(raw: string): { rows: PastedRowPartial[]; errors: string[] } {
  const norm = raw.replace(/\r\n/g, '\n');
  const lines = norm.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows: [], errors: ['No hay datos en el portapapeles. Copiá de nuevo desde Excel.'] };
  }

  // Una sola línea: o bien muchos códigos en horizontal, o una fila con fechas (parser completo)
  if (lines.length === 1) {
    const parts = lines[0]!.split('\t').map((p) => p.trim()).filter(Boolean);
    const allSap = parts.length >= 1 && parts.every(looksLikeSapCode);
    if (allSap) {
      return { rows: parts.map(emptyPastedRow), errors: [] };
    }
    return parseHeExcelTsv(raw);
  }

  // Varias líneas: si alguna parece fila completa con fechas, usar parser de tabla
  if (lines.some(lineLooksLikeFullDataRow)) {
    return parseHeExcelTsv(raw);
  }

  // Varias líneas: columna de códigos (opcional fila de título arriba)
  {
    let start = 0;
    const firstCell = lines[0]!.split('\t')[0]?.trim() ?? '';
    if (!looksLikeSapCode(firstCell) && lines.length > 1) {
      const secondFirst = lines[1]!.split('\t')[0]?.trim() ?? '';
      if (looksLikeSapCode(secondFirst)) start = 1;
    }

    const codes: string[] = [];
    const errors: string[] = [];
    for (let i = start; i < lines.length; i++) {
      const first = lines[i]!.split('\t')[0]!.trim();
      if (!first) continue;
      if (looksLikeSapCode(first)) {
        codes.push(first);
      } else {
        errors.push(`Fila ${i + 1}: «${first}» no parece un código SAP (solo números).`);
      }
    }
    if (codes.length > 0) {
      return { rows: codes.map(emptyPastedRow), errors };
    }
  }

  return parseHeExcelTsv(raw);
}
