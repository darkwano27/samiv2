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

/** Origen: lista clínica (cabecera `DIAGNOSTICO` omitida). */
const RAW_DIAGNOSES = `
ABORTO ESPONTANEO
ABSCESO CUTANEO
ABSCESO PERIANAL
ABSCESO PERIODONTAL
ACCIDENTE CEREBROVASCULAR
ADENOPATIA INGUINAL
AMENAZA DE ABORTO
ANEMIA AGUDA
APENDICITIS AGUDA
ARTRALGIA
ARTRITIS REUMATOIDE
ARTROSIS
ASMA ALERGICA
ASMA BRONQUIAL
ATRICCION
BRONQUIECTASIA
BRONQUITIS AGUDA
BURSITIS
CALCULO URINARIO
CALCULO VESICULAR
CATARATA
CEFALEA
CELULITIS
CERVICALGIA
CERVICITIS
CHALAZION
PTERIGION
COLECISTECTOMIA
COLECISTITIS AGUDA
COLEDOCOCELE
COLELITIASIS AGUDA
COLICO MENSTRUAL
COLICO RENAL
COLICO VESICULAR
CONDILOMA ACUMINADO
CONDROMALACIA
CONJUNTIVITIS AGUDA
CONSTIPACION
CONTRACTURA MUSCULAR
CONTUSION
CONVULSION NO ESPECIFICADA
COSTOCONDRITIS AGUDA
DENGUE
DERMATITIS ALERGICA
DESGARRO DE LIGAMENTO
DESGARRO DE MENISCOS
DESGARRO DE RETINA
DESGARRO DE TENDON
DESGARRO MUSCULAR
DESPRENDIMIENTO DE LA RETINA
DIABETES MELLITUS TIPO II
DISMENORREA
DISPEPSIA
DOLOR ABDOMINAL
DORSALGIA AGUDA
EFECTOS ADVERSOS DE LA INMUNIZACIÓN
ENDODONCIA
ENDOMETRIOSIS
ENFERMEDAD DE MENIERE
ENFERMEDAD INFLAMATORIA PELVICA
ENFERMEDAD PULMONAR AGUDA
ENTESOPATIA DEL TENDON
EPICONDILITIS AGUDA
EPIDIDIMITIS
EPILEPSIA
EPISTAXIS
ESCABIOSIS
ESCOLIOSIS
ESGUINCE
ESPOLON CALCANEO
ESTRABISMO
EXODONCIA
FASCITIS PLANTAR
FIBRILACION AURICULAR PAROXISTICA
FIBROADENOMA DE MAMA
FIBROSIS PULMONAR
FISURA
FRACTURA
GANGLION
GASTRITIS AGUDA
GINECORRAGIA
GINGIVITIS
GONARTROSIS
HEMATURIA EAD
HEMOPTISIS
HEMORRAGIA UTERINA DISFUNCIONAL
HEMORROIDES
HEPATOPATIA DIFUSA
HERIDA
HERPES LABIAL
HERPES ZOSTER
HIPERCOLESTEROLEMIA
HIPEREMESIS GRAVIDICA
HIPERPLASIA PROSTATICA BENIGNA
HIPERTENSION ARTERIAL
HIPERTROFIA DE LOS CORNETES NASALES
HIPOACUSIA SUBITA IDIOPATICA
INFECCION DE TRACTO URINARIO
INFECCION GASTROINTESTINAL AGUDA
INFECCION RESPIRATORIA AGUDA
INSUFICIENCIA RENAL CRONICA
INSUFICIENCIA VENOSA
INTOXICACION ALIMENTARIA
LABERINTITIS AGUDA
LARINGITIS AGUDA
LARINGOTRAQUEITIS AGUDA
LESION DE NERVIO RADIAL
LIPOMA
LITIASIS RENAL
LUMBALGIA AGUDA
LUMBOCIATALGIA
LUXACION
MIASTENIA GRAVIS
MICOSIS
MIGRAÑA
MIGRAÑA CON AURA
MIOMATOSIS UTERINA
MORDEDURA POR CAN
NECROSIS PULPAR
NEUMONIA
OBSTRUCCION INTESTINAL
ONICOCRIPTOSIS
ONICOMICOSIS
ORQUITIS, EPIDIMITIS Y ORQUIEPIDIDIMITIS
ORZUELO
OSTEOPOROSIS
OTITIS MEDIA AGUDA
OVARIO POLIQUISTICO
PAPILOMA EN MUSLO
PARALISIS FACIAL
PARONIQUIA
PERIODONTITIS AGUDA
PIE DIABETICO
PIELONEFRITIS
POLICONTUSO
POLIPO VESICULAR
PRESBICIA
PROLAPSO VAGINAL
PROSTATITIS AGUDA
PSORIASIS
PULPITIS IRREVERSIBLE
QUEILITIS ANGULAR
QUEMADURA
QUISTE EPIDERMICO
QUISTE HEMORRAGICO
QUISTE PILONIDAL
QUISTE SINOVIAL
QUISTE TESTICULAR
REACCION ALERGICA CUTANEA
REFLUJO GASTROESOFAGICO
RINITIS ALERGICA
SACROLUMBALGIA AGUDA
SEPTOPLASTIA
SINDROME DE COLON IRRITABLE
SINDROME DEL MANGUITO ROTADOR
SINDROME DEL TUNEL CARPIANO
SINDROME DOLOROSO ABDOMINAL
SINDROME EMETICO
SINDROME VERTIGINOSO
SINUSITIS AGUDA
TBC PULMONAR
TENDINITIS
TOS FERINA
TRANSTORNO DE PANICO
TRAQUEITIS
TRASTORNO DE DISCO CERVICAL
TRASTORNOS DE LA ARTICULACION MAXILAR
TRASTORNOS DE LA REFRACCIÓN
TRAUMATISMO
ULCERA DE ESOFAGO
UÑA ENCARNADA
URTICARIA
VAGINOSIS BACTERIANA
VARICES EN MIEMBROS INFERIORES
VASECTOMIA
VERTIGO POSTURAL PAROXISTICO
VOLVULO
VULVOVAGINITIS
`.trim();

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

function parseDiagnosisNames(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of RAW_DIAGNOSES.split('\n')) {
    const name = line.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const key = name.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (name.length > 200) {
      throw new Error(`Diagnóstico demasiado largo (${name.length}): ${name.slice(0, 40)}…`);
    }
    out.push(name);
  }
  return out;
}

export async function runSoCatalogSeed(db: Db): Promise<{
  diagnosesInserted: number;
  diagnosesSkipped: number;
  medicinesInserted: number;
  medicinesSkipped: number;
}> {
  let diagnosesInserted = 0;
  let diagnosesSkipped = 0;
  const dxNames = parseDiagnosisNames();

  for (const name of dxNames) {
    const [existing] = await db
      .select({ id: soDiagnoses.id })
      .from(soDiagnoses)
      .where(eq(soDiagnoses.name, name))
      .limit(1);
    if (existing) {
      diagnosesSkipped += 1;
      continue;
    }
    await db.insert(soDiagnoses).values({ name });
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
    medicinesInserted,
    medicinesSkipped,
  };
}
