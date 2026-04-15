import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema';
import { soDiagnoses, soMedicines } from '../schema/salud-ocupacional';

type Db = PostgresJsDatabase<typeof schema>;

/** Filas: descripcion_articulo, dosis, presentacion, via_administracion (mayúsculas catálogo origen). */
const RAW_MEDICINES: [string, string, string, string][] = [
  ['ASPIRINA', '500 MG', 'TABLETA', 'ORAL'],
  ['BACTRIM', '400 MG - 80 MG', 'TABLETA', 'ORAL'],
  ['KITADOL', '500 MG', 'TABLETA', 'ORAL'],
  ['BUSCAPINA', '10 MG', 'TABLETA', 'ORAL'],
  ['CAPTOPRIL', '25 MG', 'TABLETA', 'ORAL'],
  ['CELECOXIB', '200 MG', 'TABLETA', 'ORAL'],
  ['CIPROFLOXACINO', '500 MG', 'TABLETA', 'ORAL'],
  ['CLORFENAMINA', '10 MG', 'TABLETA', 'ORAL'],
  ['DEXAMETASONA', '4 MG', 'TABLETA', 'ORAL'],
  ['DICLOFENACO', '100 MG', 'TABLETA', 'ORAL'],
  ['FENAZOPIRIDINA', '100 MG', 'TABLETA', 'ORAL'],
  ['FUROSEMIDA', '40 MG', 'TABLETA', 'ORAL'],
  ['GRAVOL /DIMENHIDRINATO', '50 MG', 'TABLETA', 'ORAL'],
  ['GRIPACHECK', '500 MG - 5 MG - 2 MG', 'TABLETA', 'ORAL'],
  ['IBERSARTAN', '150 MG', 'TABLETA', 'ORAL'],
  ['IBUPROFENO', '800 MG', 'TABLETA', 'ORAL'],
  ['KETOPROFENO', '100 MG', 'TABLETA', 'ORAL'],
  ['KETOROLACO', '10 MG', 'TABLETA', 'ORAL'],
  ['LOPERAMIDA', '2 MG', 'TABLETA', 'ORAL'],
  ['LORATADINA', '10 MG', 'TABLETA', 'ORAL'],
  ['OMEPRAZOL', '100 MG', 'TABLETA', 'ORAL'],
  ['ORFENADRINA', '100 MG', 'TABLETA', 'ORAL'],
  ['PARACETAMOL', '500 MG', 'TABLETA', 'ORAL'],
  ['ANAFLEX', '10 MG', 'TABLETA', 'ORAL'],
  ['PREDNISONA', '25 MG', 'TABLETA', 'ORAL'],
  ['SIMETICONA', '80 MG /40 MG', 'TABLETA', 'ORAL'],
  ['SALES DE REHIDRATACION', 'UNI', 'SOBRE', 'ORAL'],
  ['AGUA OXIGENADA', '1 LITRO', 'MATERIAL', 'NO APLICA'],
  ['AGUJA', 'UNI', 'MATERIAL', 'NO APLICA'],
  ['ALCOHOL', '96°', 'MATERIAL', 'NO APLICA'],
  ['ALCOHOL YODADO', '120 ML', 'MATERIAL', 'NO APLICA'],
  ['BANDITAS', 'UNI', 'MATERIAL', 'NO APLICA'],
  ['BOLITAS DE ALGODÓN', 'UNI', 'MATERIAL', 'NO APLICA'],
  ['CLORURO DE SODIO', '0.90%', 'MATERIAL', 'NO APLICA'],
  ['ESPARADRAPO', 'UNI', 'MATERIAL', 'NO APLICA'],
  ['GASAS', '10x10 CM', 'MATERIAL', 'NO APLICA'],
  ['GASAS', '7.5x7.5 CM', 'MATERIAL', 'NO APLICA'],
  ['GASAS', '5x5 CM', 'MATERIAL', 'NO APLICA'],
  ['GEL PACK', 'UNI', 'MATERIAL', 'NO APLICA'],
  ['HISOPOS', 'UNI', 'MATERIAL', 'NO APLICA'],
  ['JELONET', 'UNI', 'MATERIAL', 'NO APLICA'],
  ['JERINGAS DESCARTABLES', '10CC', 'MATERIAL', 'NO APLICA'],
  ['LANCETAS DE GLUCOMETRO', 'UNI', 'MATERIAL', 'NO APLICA'],
  ['MASCARILLAS', 'KN 95', 'MATERIAL', 'NO APLICA'],
  ['STERI STRIP', '6mmx10mm', 'MATERIAL', 'NO APLICA'],
  ['TEGADERM', 'UNI', 'MATERIAL', 'NO APLICA'],
  ['TIRAS REACTIVAS DE GLUCOMETRO', 'UNI', 'MATERIAL', 'NO APLICA'],
  ['VENDA ELÁSTICA', '4x5', 'MATERIAL', 'NO APLICA'],
  ['VENDA ELASTICA MEDIANA', '6X5', 'MATERIAL', 'NO APLICA'],
  ['VENDA ELÁSTICA', '8X5', 'MATERIAL', 'NO APLICA'],
  ['FLORIL', '100 MG', 'GOTAS', 'VISUAL'],
  ['FRAMIDEX', '5 MG - 0.02 MG - 1 MG', 'GOTAS', 'VISUAL'],
  ['MEDICORTIL', '5 MG - 5 MG', 'GOTAS', 'VISUAL'],
  ['ALERGIS', '2%', 'CREMA', 'TOPICA'],
  ['DICLOFENACO', '1%', 'CREMA', 'TOPICA'],
  ['HIRUDOID FORTE', '0.45%', 'CREMA', 'TOPICA'],
  ['MUPIROCINA', '2%', 'CREMA', 'TOPICA'],
  ['SULFADIAZINA FORTE', '1%', 'CREMA', 'TOPICA'],
  ['CEFTRIAXONA', '1 GR', 'AMPOLLA', 'INTRAMUSCULAR'],
  ['CLORFENAMINA', '10 MG / 1 ML', 'AMPOLLA', 'INTRAMUSCULAR'],
  ['DEXAMETASONA', '4 MG / 1 ML', 'AMPOLLA', 'INTRAMUSCULAR'],
  ['DICLOFENACO', '75 MG / 3 ML', 'AMPOLLA', 'INTRAMUSCULAR'],
  ['DIMENHIDRINATO', '50 MG / 1 ML', 'AMPOLLA', 'INTRAMUSCULAR'],
  ['ESCOPOLAMINA', '20 MG / 1 ML', 'AMPOLLA', 'INTRAMUSCULAR'],
  ['FUROSEMIDA', '20 MG / 2 ML', 'AMPOLLA', 'INTRAMUSCULAR'],
  ['KETOPROFENO', '100 MG / 2 ML', 'AMPOLLA', 'INTRAMUSCULAR'],
  ['KETOROLACO', '30 MG / 1 ML', 'AMPOLLA', 'INTRAMUSCULAR'],
  ['LIDOCAINA', '2%', 'AMPOLLA', 'INTRAMUSCULAR'],
  ['METAMIZOL', '1GR', 'AMPOLLA', 'INTRAMUSCULAR'],
  ['ORFENADRINA', '60 MG / 2 ML', 'AMPOLLA', 'INTRAMUSCULAR'],
  ['ARNICA SPORT', '10% - 1% - 1%', 'AEROSOL', 'TOPICA'],
];

const PRES_MAP: Record<string, string> = {
  TABLETA: 'Tableta',
  MATERIAL: 'Material',
  SOBRE: 'Sobre',
  GOTAS: 'Gotas',
  CREMA: 'Crema',
  AMPOLLA: 'Ampolla',
  AEROSOL: 'Aerosol',
};

const VIA_MAP: Record<string, string> = {
  ORAL: 'Oral (VO)',
  'NO APLICA': 'No aplica',
  VISUAL: 'Oftálmica',
  TOPICA: 'Tópica',
  INTRAMUSCULAR: 'Intramuscular (IM)',
};

function mapPresentation(raw: string): string {
  const k = raw.trim().toUpperCase();
  const v = PRES_MAP[k];
  if (!v) throw new Error(`Presentación no mapeada: "${raw}"`);
  return v;
}

function mapRoute(raw: string): string {
  const k = raw.trim().toUpperCase();
  const v = VIA_MAP[k];
  if (!v) throw new Error(`Vía no mapeada: "${raw}"`);
  return v;
}

function inventoryUnitForPresentation(presentationCanon: string): string {
  switch (presentationCanon) {
    case 'Tableta':
      return 'tableta';
    case 'Material':
      return 'unidad';
    case 'Sobre':
      return 'sobre';
    case 'Gotas':
      return 'frasco';
    case 'Crema':
      return 'tubo';
    case 'Ampolla':
      return 'ampolla';
    case 'Aerosol':
      return 'unidad';
    default:
      return 'unidad';
  }
}

function loadCie10Raw(): string {
  return readFileSync(
    join(process.cwd(), 'src/core/database/seeds/so-diagnoses-cie10.raw.txt'),
    'utf8',
  );
}

/** Líneas `NOMBRE — Código` (separador em dash con espacios). */
function parseCie10Lines(raw: string): { name: string; code: string }[] {
  const seen = new Set<string>();
  const out: { name: string; code: string }[] = [];
  const sep = ' — ';
  for (const line of raw.split('\n')) {
    const trimmed = line.trim().replace(/\s+/g, ' ');
    if (!trimmed) continue;
    const idx = trimmed.indexOf(sep);
    if (idx === -1) {
      throw new Error(`Línea CIE-10 inválida (falta " — "): ${trimmed.slice(0, 80)}`);
    }
    const name = trimmed.slice(0, idx).trim();
    const code = trimmed.slice(idx + sep.length).trim();
    if (!name || !code) {
      throw new Error(`Línea CIE-10 inválida: ${trimmed}`);
    }
    if (name.length > 200) {
      throw new Error(`Diagnóstico demasiado largo (${name.length}): ${name.slice(0, 40)}…`);
    }
    if (code.length > 20) {
      throw new Error(`Código CIE-10 demasiado largo (${code.length}): ${code}`);
    }
    const key = name.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, code });
  }
  return out;
}

export async function runSoCatalogSeed(db: Db): Promise<{
  diagnosesInserted: number;
  diagnosesSkipped: number;
  diagnosesUpdated: number;
  medicinesInserted: number;
  medicinesSkipped: number;
}> {
  let diagnosesInserted = 0;
  let diagnosesSkipped = 0;
  let diagnosesUpdated = 0;
  const dxRows = parseCie10Lines(loadCie10Raw());

  for (const { name, code } of dxRows) {
    const [existing] = await db
      .select({
        id: soDiagnoses.id,
        code: soDiagnoses.code,
      })
      .from(soDiagnoses)
      .where(eq(soDiagnoses.name, name))
      .limit(1);
    if (existing) {
      const prev = (existing.code ?? '').trim();
      if (prev !== code) {
        await db
          .update(soDiagnoses)
          .set({ code })
          .where(eq(soDiagnoses.id, existing.id));
        diagnosesUpdated += 1;
      } else {
        diagnosesSkipped += 1;
      }
      continue;
    }
    await db.insert(soDiagnoses).values({ name, code });
    diagnosesInserted += 1;
  }

  let medicinesInserted = 0;
  let medicinesSkipped = 0;
  const seenMed = new Set<string>();

  for (const [desc, dosis, presRaw, viaRaw] of RAW_MEDICINES) {
    const name = desc.trim();
    const concentration = dosis.trim();
    const presentation = mapPresentation(presRaw);
    const administrationRoute = mapRoute(viaRaw);
    const inventoryUnit = inventoryUnitForPresentation(presentation);
    const dedupeKey = `${name}|${concentration}|${presentation}|${administrationRoute}`;
    if (seenMed.has(dedupeKey)) continue;
    seenMed.add(dedupeKey);

    const [exists] = await db
      .select({ id: soMedicines.id })
      .from(soMedicines)
      .where(
        and(
          eq(soMedicines.name, name),
          eq(soMedicines.concentration, concentration),
          eq(soMedicines.presentation, presentation),
        ),
      )
      .limit(1);
    if (exists) {
      medicinesSkipped += 1;
      continue;
    }

    await db.insert(soMedicines).values({
      name,
      concentration,
      presentation,
      administrationRoute,
      inventoryUnit,
    });
    medicinesInserted += 1;
  }

  return {
    diagnosesInserted,
    diagnosesSkipped,
    diagnosesUpdated,
    medicinesInserted,
    medicinesSkipped,
  };
}
