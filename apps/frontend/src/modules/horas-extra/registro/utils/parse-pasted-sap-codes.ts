/** Quita separadores típicos de Excel (miles, espacios). */
export function normalizeSapCodeCell(raw: string): string {
  return raw.replace(/[\s.]/g, '');
}

export function isValidSapCodeDigits(normalized: string): boolean {
  return /^\d{5,11}$/.test(normalized);
}

/** Extrae celdas “primera columna” por fila; si hay una sola fila con tabs, trata cada celda como código (fila horizontal en Excel). */
export function extractFirstColumnCells(raw: string): string[] {
  const norm = raw.replace(/\r\n/g, '\n');
  const lines = norm.split('\n');
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  if (nonEmptyLines.length === 1 && nonEmptyLines[0]!.includes('\t')) {
    return nonEmptyLines[0]!
      .split('\t')
      .map((c) => c.trim())
      .filter(Boolean);
  }
  return lines
    .map((line) => (line.split('\t')[0] ?? '').trim())
    .filter((c) => c.length > 0);
}

export type PasteCodeRowStatus = 'valid' | 'invalid' | 'dup_paste' | 'dup_table';

export type PasteCodePreviewItem = {
  raw: string;
  normalized: string | null;
  status: PasteCodeRowStatus;
};

/**
 * Vista previa por celda y lista final para confirmar (sin duplicados vs tabla ni dentro del pegado).
 */
export function buildPasteCodePreview(
  raw: string,
  existingCodes: string[],
): { items: PasteCodePreviewItem[]; codesToAdd: string[]; detectedValidShapeCount: number } {
  const existingNorm = new Set(
    existingCodes.map((c) => normalizeSapCodeCell(c.trim())).filter((n) => n.length > 0),
  );
  const cells = extractFirstColumnCells(raw);
  const items: PasteCodePreviewItem[] = [];
  const seenInPaste = new Set<string>();
  const codesToAdd: string[] = [];
  let detectedValidShapeCount = 0;

  for (const cell of cells) {
    const normalized = normalizeSapCodeCell(cell);
    if (!normalized || !isValidSapCodeDigits(normalized)) {
      items.push({
        raw: cell,
        normalized: normalized && normalized.length > 0 ? normalized : null,
        status: 'invalid',
      });
      continue;
    }

    detectedValidShapeCount += 1;

    if (existingNorm.has(normalized)) {
      items.push({ raw: cell, normalized, status: 'dup_table' });
      continue;
    }

    if (seenInPaste.has(normalized)) {
      items.push({ raw: cell, normalized, status: 'dup_paste' });
      continue;
    }

    seenInPaste.add(normalized);
    codesToAdd.push(normalized);
    items.push({ raw: cell, normalized, status: 'valid' });
  }

  return { items, codesToAdd, detectedValidShapeCount };
}

/** Lista simple de códigos válidos únicos (misma regla que codesToAdd). */
export function parsePastedCodes(raw: string, existingCodes: string[] = []): string[] {
  return buildPasteCodePreview(raw, existingCodes).codesToAdd;
}
