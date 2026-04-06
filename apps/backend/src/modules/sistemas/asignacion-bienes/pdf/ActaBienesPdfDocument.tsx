/**
 * PDF — Formato estándar v1 (entrega / devolución de bienes), replicado en @react-pdf/renderer.
 */

import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ActaBienesBody } from '../asignacion-bienes-acta.schema';

const TEAL = '#009688';
const TEAL_DARK = '#004d40';

const POLICY_TEXT =
  'EL TRABAJADOR, deberá informar de manera inmediata cualquier desperfecto o daño que suficieren o bien entregado, con la finalidad de ser alertado a la brevedad posible. Por ningún motivo deberá hacerlo por cuenta propia.\n\n' +
  'EL TRABAJADOR, manifiesta que firma a fin de ser buenas condiciones, comprometiéndose a cargo pago de él si cumplimiento de sus funciones o de responsabilidad por todos los actos que pudieran devenir o resultar por la custodia y uso de los bienes que se le otorgan. Comprometiéndose asimismo a devolverlos cuando se le requieran, en las mismas condiciones en que los recibió, salvo el deterioro por el uso normal de los mismos. Si el trabajador fuere separado del centro de labores se obliga a entregar todos los bienes bajo su responsabilidad, caso de "NO HACERLO".';

const CAT_DESCRIPTIVA = new Set([
  'celular',
  'desktop',
  'laptop',
  'tablet',
  'impresora',
  'anexo',
  'terminal',
]);

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 8.5,
    color: '#000',
    paddingTop: 22,
    paddingBottom: 28,
    paddingHorizontal: 28,
    lineHeight: 1.15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: TEAL,
    paddingBottom: 10,
    marginBottom: 12,
    minHeight: 48,
  },
  logoWrap: {
    position: 'absolute',
    left: 6,
    top: 0,
    bottom: 10,
    justifyContent: 'center',
    width: 108,
  },
  logoImg: { width: 100, maxHeight: 38, objectFit: 'contain' as const },
  logoFallback: {
    backgroundColor: TEAL,
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    paddingVertical: 6,
    paddingHorizontal: 8,
    letterSpacing: 2,
  },
  title: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 700,
    color: TEAL,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1,
    marginHorizontal: 92,
    lineHeight: 1.2,
  },
  dateRow: {
    textAlign: 'right',
    fontSize: 7.5,
    color: '#666',
    marginBottom: 8,
    lineHeight: 1.2,
  },
  sectionBar: {
    backgroundColor: TEAL,
    color: '#fff',
    fontSize: 7.5,
    fontWeight: 700,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    lineHeight: 1.15,
  },
  userRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#ddd',
    borderBottomWidth: 1,
  },
  userRowFirst: {
    borderTopWidth: 1,
  },
  cellLabel: {
    width: '15%',
    backgroundColor: '#f5f5f5',
    borderRightWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontSize: 6.5,
    fontWeight: 700,
    color: TEAL_DARK,
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 1.1,
  },
  cellValue: {
    width: '35%',
    borderRightWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 8,
    color: '#333',
    lineHeight: 1.15,
  },
  cellValueLast: {
    width: '35%',
    borderRightWidth: 0,
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 8,
    color: '#333',
    lineHeight: 1.15,
  },
  ath: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  /** Anchos fijos para alinear encabezado y filas (descripción más ancha). */
  athCellFecha: {
    width: '12%',
    borderRightWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontSize: 6.5,
    fontWeight: 700,
    color: TEAL_DARK,
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 1.1,
  },
  athCellCat: {
    width: '16%',
    borderRightWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontSize: 6.5,
    fontWeight: 700,
    color: TEAL_DARK,
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 1.1,
  },
  athCellDesc: {
    width: '40%',
    borderRightWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontSize: 6.5,
    fontWeight: 700,
    color: TEAL_DARK,
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 1.1,
  },
  athCellCom: {
    width: '32%',
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontSize: 6.5,
    fontWeight: 700,
    color: TEAL_DARK,
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 1.1,
  },
  atRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ddd',
    alignItems: 'flex-start',
  },
  atCellFecha: {
    width: '12%',
    borderRightWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 3,
    paddingHorizontal: 3,
    fontSize: 7.5,
    textAlign: 'center',
    color: '#333',
    lineHeight: 1.12,
  },
  atCellCat: {
    width: '16%',
    borderRightWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 3,
    paddingHorizontal: 3,
    fontSize: 7.5,
    textAlign: 'center',
    color: '#333',
    lineHeight: 1.12,
  },
  atCellDesc: {
    width: '40%',
    borderRightWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 7.5,
    textAlign: 'left',
    color: '#333',
    lineHeight: 1.12,
  },
  atCellCom: {
    width: '32%',
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 7.5,
    textAlign: 'left',
    color: '#333',
    lineHeight: 1.12,
  },
  signOuter: {
    marginTop: 12,
    borderWidth: 2,
    borderColor: TEAL,
    borderRadius: 4,
  },
  signBar: {
    backgroundColor: TEAL,
    color: '#fff',
    fontSize: 7.5,
    fontWeight: 700,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingVertical: 6,
    lineHeight: 1.1,
  },
  signBody: {
    padding: 10,
    backgroundColor: '#fafafa',
  },
  policyBox: {
    fontSize: 7.5,
    lineHeight: 1.22,
    textAlign: 'justify',
    color: '#333',
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  signBoxes: {
    flexDirection: 'row',
  },
  signBox: {
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: TEAL,
    borderRadius: 4,
    padding: 8,
    backgroundColor: '#fff',
  },
  signArea: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: TEAL,
    borderRadius: 3,
    marginBottom: 6,
    backgroundColor: '#fff',
  },
  signImg: { maxWidth: '100%', maxHeight: 44, objectFit: 'contain' as const },
  signName: {
    fontSize: 7.5,
    fontWeight: 700,
    color: TEAL,
    textTransform: 'uppercase',
    textAlign: 'center',
    borderTopWidth: 2,
    borderTopColor: TEAL,
    paddingTop: 4,
    lineHeight: 1.1,
  },
  photoTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: TEAL,
    marginBottom: 6,
    marginTop: 4,
    lineHeight: 1.15,
  },
  photo: {
    width: '100%',
    maxHeight: 220,
    objectFit: 'contain' as const,
    marginBottom: 8,
  },
});

function signatureSrc(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if (s.startsWith('data:')) return s;
  return `data:image/png;base64,${s}`;
}

function formatAssetDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  try {
    const x = new Date(iso);
    if (!Number.isNaN(x.getTime())) return x.toISOString().slice(0, 10);
  } catch {
    /* ignore */
  }
  return iso;
}

function assetDescripcionV1(a: ActaBienesBody['assets'][0]): string {
  const categoria = (a.categoria || '').toLowerCase();
  if (CAT_DESCRIPTIVA.has(categoria)) {
    const parts: string[] = [];
    if (a.marca && a.marca !== 'N/A') parts.push(a.marca);
    if (a.modelo && a.modelo !== 'N/A') parts.push(a.modelo);
    if (a.name && a.name !== 'N/A') parts.push(a.name);
    return parts.join(' - ');
  }
  return a.tipo && a.tipo !== 'N/A' && a.tipo !== 'null' ? a.tipo : '';
}

export function ActaBienesPdfDocument({
  payload,
  logoSrc,
}: {
  payload: ActaBienesBody;
  logoSrc?: string;
}) {
  const titleText =
    payload.report_kind === 'devolucion'
      ? 'FORMATO DE DEVOLUCIÓN DE BIENES'
      : 'FORMATO DE ENTREGA DE BIENES';

  const o = payload.oracle_user;
  const codigo =
    (payload.glpi_registration_number?.trim() || '').length > 0
      ? payload.glpi_registration_number!.trim()
      : payload.worker_sap;
  const usuarioGlpi = [payload.glpi_firstname, payload.glpi_realname]
    .filter(Boolean)
    .join(' ')
    .trim();
  const usuario =
    (o?.usuario?.trim() || '').length > 0 ? o!.usuario!.trim() : usuarioGlpi || payload.worker_name;

  const workerSignLabel = (() => {
    const base = usuarioGlpi || payload.worker_name;
    const add = payload.additional_signer?.name?.trim();
    return add ? `${base} (${add})` : base;
  })();

  const jefeDisplay = (() => {
    const name = o?.jefe_nombre?.trim();
    if (name) return name;
    return o?.jefe?.trim() ?? '';
  })();

  const techName = (payload.technician_name ?? '').trim();
  const techSig = signatureSrc(payload.technician_signature_png_base64 ?? null);
  const workerSig = signatureSrc(payload.signature_png_base64);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            {logoSrc ? (
              <Image src={logoSrc} style={styles.logoImg} />
            ) : (
              <Text style={styles.logoFallback}>ARIS</Text>
            )}
          </View>
          <Text style={styles.title}>{titleText}</Text>
        </View>

        <Text style={styles.dateRow}>
          <Text style={{ fontWeight: 700 }}>Fecha:</Text> {payload.act_date}
        </Text>

        <Text style={styles.sectionBar}>DATOS DE USUARIO</Text>
        <View style={[styles.userRow, styles.userRowFirst]}>
          <Text style={styles.cellLabel}>CÓDIGO</Text>
          <Text style={styles.cellValue}>{codigo}</Text>
          <Text style={styles.cellLabel}>USUARIO</Text>
          <Text style={styles.cellValueLast}>{usuario}</Text>
        </View>
        <View style={styles.userRow}>
          <Text style={styles.cellLabel}>SUBDIVISIÓN</Text>
          <Text style={styles.cellValue}>{o?.subdivision?.trim() ?? ''}</Text>
          <Text style={styles.cellLabel}>DIVISIÓN</Text>
          <Text style={styles.cellValueLast}>{o?.division?.trim() ?? ''}</Text>
        </View>
        <View style={styles.userRow}>
          <Text style={styles.cellLabel}>CARGO</Text>
          <Text style={styles.cellValue}>{o?.cargo?.trim() ?? ''}</Text>
          <Text style={styles.cellLabel}>JEFE</Text>
          <Text style={styles.cellValueLast}>{jefeDisplay}</Text>
        </View>

        <Text style={styles.sectionBar}>ASIGNACIÓN ACTUAL</Text>
        <View style={styles.ath}>
          <Text style={styles.athCellFecha}>Fecha</Text>
          <Text style={styles.athCellCat}>Categoría</Text>
          <Text style={styles.athCellDesc}>Descripción</Text>
          <Text style={styles.athCellCom}>Comentario</Text>
        </View>
        {payload.assets.map((a) => (
          <View key={a.id} style={styles.atRow} wrap>
            <Text style={styles.atCellFecha}>{formatAssetDate(a.fecha_asignacion)}</Text>
            <Text style={styles.atCellCat}>{a.categoria ?? ''}</Text>
            <Text style={styles.atCellDesc}>{assetDescripcionV1(a)}</Text>
            <Text style={styles.atCellCom}>{a.comentario?.trim() ?? ''}</Text>
          </View>
        ))}

        <View style={styles.signOuter} wrap={false}>
          <Text style={styles.signBar}>POLÍTICAS SOBRE USO DE EQUIPOS</Text>
          <View style={styles.signBody}>
            <Text style={styles.policyBox}>{POLICY_TEXT}</Text>
            <View style={styles.signBoxes}>
              <View style={styles.signBox}>
                <View style={styles.signArea}>
                  {techSig ? (
                    <Image src={techSig} style={styles.signImg} />
                  ) : null}
                </View>
                <Text style={styles.signName}>{techName || ' '}</Text>
              </View>
              <View style={styles.signBox}>
                <View style={styles.signArea}>
                  {workerSig ? <Image src={workerSig} style={styles.signImg} /> : null}
                </View>
                <Text style={styles.signName}>{workerSignLabel}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>

      {payload.photos.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              {logoSrc ? (
                <Image src={logoSrc} style={styles.logoImg} />
              ) : (
                <Text style={styles.logoFallback}>ARIS</Text>
              )}
            </View>
            <Text style={styles.title}>{titleText}</Text>
          </View>
          <Text style={styles.photoTitle}>Registro fotográfico</Text>
          {payload.photos.map((p, i) => (
            <Image
              key={i}
              src={`data:${p.mime};base64,${p.base64}`}
              style={styles.photo}
            />
          ))}
        </Page>
      ) : null}
    </Document>
  );
}
