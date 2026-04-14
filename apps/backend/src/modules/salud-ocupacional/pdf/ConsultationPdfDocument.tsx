/**
 * PDF — Ficha de atención médica (tópico SO), alineada a la ficha HTML de referencia.
 */

import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { ArisPdfFooter, arisPdfPageStyles } from '@core/pdf/components/ArisShell';
import type { ConsultationDetail } from '../consultations.repository';

const TEAL = '#21a795';

const styles = StyleSheet.create({
  page: {
    ...arisPdfPageStyles.page,
    paddingTop: 14,
    paddingBottom: 38,
    paddingHorizontal: 26,
    fontSize: 8.5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logoWrap: {
    width: 128,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImg: {
    width: 124,
    height: 32,
    objectFit: 'contain' as const,
  },
  brandMark: {
    fontSize: 20,
    fontWeight: 800,
    color: TEAL,
    letterSpacing: -0.5,
  },
  brandBlock: {
    borderLeftWidth: 2,
    borderLeftColor: TEAL,
    paddingLeft: 6,
    marginLeft: 2,
    justifyContent: 'center',
  },
  brandSam: { fontSize: 9, fontWeight: 600, color: '#333' },
  brandSub: { fontSize: 6.5, color: '#888', marginTop: 1 },
  metaRight: { fontSize: 7.5, color: '#888', textAlign: 'right' },
  banner: {
    backgroundColor: TEAL,
    paddingVertical: 4,
    marginBottom: 6,
    alignItems: 'center',
  },
  bannerTxt: {
    fontSize: 9,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: 0.45,
  },
  sectionWrap: { marginBottom: 6 },
  /** Bloques 1–2 más densos */
  sectionTight: { marginBottom: 5 },
  tab: {
    alignSelf: 'flex-start',
    backgroundColor: TEAL,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tabTxt: {
    fontSize: 7,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: 0.35,
  },
  box: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 3,
    borderTopLeftRadius: 0,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e8e8e8' },
  rowLast: { flexDirection: 'row' },
  cellLabel: {
    width: '24%',
    paddingVertical: 2,
    paddingHorizontal: 3,
    backgroundColor: '#f5f5f5',
    fontSize: 7,
    fontWeight: 700,
    color: '#555',
    borderRightWidth: 0.5,
    borderRightColor: '#e8e8e8',
  },
  cellVal: {
    flex: 1,
    paddingVertical: 2,
    paddingHorizontal: 3,
    fontSize: 7.5,
    color: '#171717',
    lineHeight: 1.25,
  },
  cellValFull: {
    flex: 1,
    paddingVertical: 2,
    paddingHorizontal: 3,
    fontSize: 7.5,
    color: '#171717',
    lineHeight: 1.25,
  },
  emailAccent: { color: TEAL },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 8,
    fontSize: 7,
    fontWeight: 600,
  },
  dxHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e8e8e8',
  },
  dxTh: {
    padding: 4,
    fontSize: 7,
    fontWeight: 700,
    color: '#555',
    borderRightWidth: 0.5,
    borderRightColor: '#e8e8e8',
  },
  dxRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e8e8e8' },
  dxCell: { padding: 4, fontSize: 8, borderRightWidth: 0.5, borderRightColor: '#e8e8e8' },
  dxCode: { fontFamily: 'Roboto', color: TEAL, fontWeight: 600 },
  rxBlock: {
    padding: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e8e8e8',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rxTitle: { fontSize: 9, fontWeight: 700, color: '#115e59' },
  rxMeta: { fontSize: 7, color: '#666', marginTop: 1 },
  rxInd: {
    marginTop: 2,
    fontSize: 7,
    color: '#888',
    borderLeftWidth: 2,
    borderLeftColor: TEAL,
    paddingLeft: 5,
  },
  rxQty: {
    fontSize: 7,
    backgroundColor: '#e0f2f1',
    color: '#00695c',
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 8,
    fontWeight: 600,
  },
  /** Bloques 3–4: aspecto de documento clínico (más énfasis que 1–2). */
  clinicalWrap: { marginBottom: 6 },
  clinicalTab: {
    alignSelf: 'stretch',
    backgroundColor: '#0f766e',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  clinicalTabTxt: {
    fontSize: 8,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: 0.35,
  },
  clinicalBox: {
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 3,
    borderTopLeftRadius: 0,
    overflow: 'hidden',
  },
  dxHeaderClinical: {
    flexDirection: 'row',
    backgroundColor: '#ccfbf1',
    borderBottomWidth: 1,
    borderBottomColor: TEAL,
  },
  dxThClinical: {
    paddingVertical: 3,
    paddingHorizontal: 5,
    fontSize: 7,
    fontWeight: 800,
    color: '#134e4a',
    borderRightWidth: 1,
    borderRightColor: TEAL,
  },
  dxRowClinical: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#99f6e4',
    backgroundColor: '#fafafa',
  },
  dxCellClinical: {
    paddingVertical: 3,
    paddingHorizontal: 5,
    fontSize: 8,
    borderRightWidth: 0.5,
    borderRightColor: '#ccfbf1',
  },
  dxNameClinical: {
    fontSize: 8.5,
    fontWeight: 700,
    color: '#0f172a',
    lineHeight: 1.2,
  },
  rxBlockClinical: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#99f6e4',
    flexDirection: 'column',
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    backgroundColor: '#f0fdfa',
  },
  rxTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
  },
  rxTitleClinical: { flex: 1, fontSize: 9, fontWeight: 800, color: '#0f766e', lineHeight: 1.2 },
  rxMetaClinical: { fontSize: 7, color: '#334155', marginTop: 1, lineHeight: 1.2 },
  rxIndClinical: {
    marginTop: 2,
    fontSize: 7,
    color: '#475569',
    borderLeftWidth: 2,
    borderLeftColor: TEAL,
    paddingLeft: 5,
    lineHeight: 1.2,
  },
  rxQtyClinical: {
    fontSize: 7,
    fontWeight: 800,
    backgroundColor: TEAL,
    color: '#fff',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  sigCol: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  sigColProf: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  sigRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 3,
    alignItems: 'stretch',
  },
  sigDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#e0e0e0',
  },
  sigPatientName: {
    fontSize: 7.5,
    fontWeight: 700,
    color: '#404040',
    textAlign: 'center',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  sigCaptionUnder: {
    fontSize: 6.5,
    color: '#737373',
    marginTop: 5,
    textAlign: 'center',
  },
  sigPlaceholder: { fontSize: 7, color: '#aaa', fontStyle: 'italic' },
  sigImgPatient: { width: 210, height: 62, objectFit: 'contain' as const },
  sigImgProf: { width: 230, height: 72, objectFit: 'contain' as const },
});

const DISCHARGE_LABEL: Record<string, string> = {
  observacion: 'Observación',
  recuperado: 'Recuperado / Alta',
  derivado: 'Derivado',
};

function fmtDateTime(d: Date | string): string {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  return x.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtDateOnly(d: Date | string): string {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  return x.toLocaleDateString('es-PE', { dateStyle: 'short' });
}

function isRenderableImageDataUrl(s: string | undefined | null): boolean {
  const t = s?.trim();
  return Boolean(t && t.startsWith('data:image'));
}

export type ConsultationPdfAttentionRowVariant = 'attended_by' | 'alerta_medica';

type Props = {
  detail: Exclude<ConsultationDetail, null>;
  /** Nombre del profesional que atiende (sin código). */
  professionalDisplayName: string;
  /** Firma o sello desde Mi firma (`worker_signatures`). */
  professionalSignatureDataUrl?: string | null;
  logoSrc?: string;
  /**
   * `alerta_medica`: solo perfil de módulo SO "Supervisor" (etiqueta + texto fijo).
   * Admin SO y enfermera usan `attended_by` (nombre completo).
   */
  attentionRowVariant?: ConsultationPdfAttentionRowVariant;
};

export function ConsultationPdfDocument({
  detail,
  professionalDisplayName,
  professionalSignatureDataUrl,
  logoSrc,
  attentionRowVariant = 'attended_by',
}: Props) {
  const discharge =
    DISCHARGE_LABEL[detail.dischargeCondition] ?? detail.dischargeCondition;

  const patientSig = detail.signatureData?.trim();
  const hasPatientSig = isRenderableImageDataUrl(patientSig);
  const profSig = professionalSignatureDataUrl?.trim();
  const hasProfSig = isRenderableImageDataUrl(profSig);

  const referredNameOnly = (detail.referredByName ?? '').trim();
  const attendedName = (professionalDisplayName ?? '').trim() || '—';
  const isAlertaMedica = attentionRowVariant === 'alerta_medica';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topRow}>
          <View style={styles.brandLeft}>
            {logoSrc ? (
              <View style={styles.logoWrap}>
                <Image src={logoSrc} style={styles.logoImg} />
              </View>
            ) : (
              <Text style={styles.brandMark}>ARIS</Text>
            )}
            <View style={styles.brandBlock}>
              <Text style={styles.brandSam}>SAMI</Text>
              <Text style={styles.brandSub}>
                Sistema Administrativo Modular Integrado
              </Text>
            </View>
          </View>
          <View>
            <Text style={styles.metaRight}>Fecha: {fmtDateOnly(detail.attentionDate)}</Text>
            <Text style={styles.metaRight}>Nº {detail.correlative}</Text>
          </View>
        </View>

        <View style={styles.banner}>
          <Text style={styles.bannerTxt}>FICHA DE ATENCIÓN MÉDICA DE TÓPICO</Text>
        </View>

        {/* 1. Paciente — compacto */}
        <View style={styles.sectionTight}>
          <View style={styles.tab}>
            <Text style={styles.tabTxt}>1. DATOS DEL PACIENTE</Text>
          </View>
          <View style={styles.box}>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>NOMBRE</Text>
              <Text style={styles.cellVal}>{detail.patientName}</Text>
              <Text style={[styles.cellLabel, { width: '18%' }]}>CÓDIGO</Text>
              <Text style={[styles.cellVal, { flex: 0.55 }]}>{detail.patientCod}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>SEDE</Text>
              <Text style={styles.cellVal}>{detail.patientEstabl ?? '—'}</Text>
              <Text style={[styles.cellLabel, { width: '18%' }]}>EDAD</Text>
              <Text style={[styles.cellVal, { flex: 0.55 }]}>
                {detail.patientAge != null ? `${detail.patientAge} años` : '—'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>CARGO</Text>
              <Text style={styles.cellVal}>{detail.patientPosition ?? '—'}</Text>
              <Text style={[styles.cellLabel, { width: '18%' }]}>N.º DOC.</Text>
              <Text style={[styles.cellVal, { flex: 0.55 }]}>
                {detail.patientDocumentId ?? '—'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>DIVISIÓN</Text>
              <Text style={styles.cellVal}>{detail.patientDivision ?? '—'}</Text>
              <Text style={[styles.cellLabel, { width: '18%' }]}>SUBDIVISIÓN</Text>
              <Text style={[styles.cellVal, { flex: 0.55 }]}>
                {detail.patientSubdivision ?? '—'}
              </Text>
            </View>
            {detail.patientEmail ? (
              <View style={styles.rowLast}>
                <Text style={styles.cellLabel}>CORREO</Text>
                <Text style={[styles.cellValFull, styles.emailAccent]}>{detail.patientEmail}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 2. Atención — compacto */}
        <View style={styles.sectionTight}>
          <View style={styles.tab}>
            <Text style={styles.tabTxt}>2. DETALLES DE LA ATENCIÓN</Text>
          </View>
          <View style={styles.box}>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>
                {isAlertaMedica ? 'ALERTA MÉDICA' : 'ATENDIDO POR'}
              </Text>
              <Text style={[styles.cellValFull, { borderBottomWidth: 0.5 }]}>
                {isAlertaMedica ? 'Alerta médica' : attendedName}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>FECHA Y HORA</Text>
              <Text style={styles.cellVal}>{fmtDateTime(detail.attentionDate)}</Text>
              <Text style={[styles.cellLabel, { width: '26%' }]}>CONDICIÓN AL ALTA</Text>
              <View style={[styles.cellVal, { flex: 0.5, justifyContent: 'center' }]}>
                <Text style={styles.badge}>{discharge}</Text>
              </View>
            </View>
            {referredNameOnly ? (
              <View style={styles.row}>
                <Text style={styles.cellLabel}>DERIVADO / REFERIDO POR</Text>
                <Text style={styles.cellValFull}>{referredNameOnly}</Text>
              </View>
            ) : null}
            {detail.receiptNumber ? (
              <View style={styles.row}>
                <Text style={styles.cellLabel}>N.º RECIBO / BOLETA</Text>
                <Text style={styles.cellValFull}>{detail.receiptNumber}</Text>
              </View>
            ) : null}
            <View style={styles.rowLast}>
              <Text style={[styles.cellLabel, { alignSelf: 'stretch' }]}>MOTIVO</Text>
              <Text style={[styles.cellValFull, { minHeight: 16 }]}>{detail.reason ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* 3. Diagnósticos — énfasis clínico */}
        <View style={styles.clinicalWrap}>
          <View style={styles.clinicalTab}>
            <Text style={styles.clinicalTabTxt}>3. DIAGNÓSTICOS PRESUNTIVOS</Text>
          </View>
          <View style={styles.clinicalBox}>
            <View style={styles.dxHeaderClinical}>
              <Text style={[styles.dxThClinical, { width: '12%' }]}>#</Text>
              <Text style={[styles.dxThClinical, { flex: 1, borderRightWidth: 0 }]}>
                DIAGNÓSTICO
              </Text>
            </View>
            {detail.diagnoses.length === 0 ? (
              <Text style={{ padding: 6, fontSize: 8, color: '#64748b' }}>
                Sin diagnósticos registrados.
              </Text>
            ) : (
              detail.diagnoses.map((d, i) => (
                <View
                  key={d.id}
                  style={[
                    styles.dxRowClinical,
                    i === detail.diagnoses.length - 1 ? { borderBottomWidth: 0 } : {},
                  ]}
                >
                  <Text
                    style={[styles.dxCellClinical, { width: '12%', textAlign: 'center' }]}
                  >
                    {i + 1}
                  </Text>
                  <Text style={[styles.dxCellClinical, styles.dxNameClinical, { flex: 1, borderRightWidth: 0 }]}>
                    {d.name}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* 4. Prescripción — énfasis clínico */}
        <View style={styles.clinicalWrap}>
          <View style={styles.clinicalTab}>
            <Text style={styles.clinicalTabTxt}>4. PRESCRIPCIÓN MÉDICA</Text>
          </View>
          <View style={styles.clinicalBox}>
            {detail.prescriptions.length === 0 ? (
              <Text style={{ padding: 6, fontSize: 8, color: '#64748b' }}>
                Sin medicación ni insumos registrados.
              </Text>
            ) : (
              detail.prescriptions.map((p, idx) => (
                <View
                  key={p.id}
                  style={[
                    styles.rxBlockClinical,
                    idx === detail.prescriptions.length - 1 ? { borderBottomWidth: 0 } : {},
                  ]}
                >
                  <View style={styles.rxTitleRow}>
                    <Text style={styles.rxTitleClinical}>{p.medicineName}</Text>
                    <Text style={styles.rxQtyClinical}>Cant: {p.quantity}</Text>
                  </View>
                  <Text style={styles.rxMetaClinical}>
                    {[p.presentation, p.concentration, p.administrationRoute]
                      .filter(Boolean)
                      .join(' · ')}
                    {p.frequency ? ` · ${p.frequency}` : ''}
                    {p.duration ? ` · ${p.duration}` : ''}
                  </Text>
                  {p.instructions ? (
                    <Text style={styles.rxIndClinical}>{p.instructions}</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </View>

        {/* 5. Firmas paciente + profesional */}
        <View style={styles.sectionWrap}>
          <View style={styles.tab}>
            <Text style={styles.tabTxt}>5. FIRMAS (PACIENTE Y PROFESIONAL)</Text>
          </View>
          <View style={styles.box}>
            <View style={styles.sigRow}>
              <View style={styles.sigCol}>
                <Text style={styles.sigPatientName}>{detail.patientName}</Text>
                {hasPatientSig && patientSig ? (
                  <Image src={patientSig} style={styles.sigImgPatient} />
                ) : (
                  <Text style={styles.sigPlaceholder}>Sin firma del paciente</Text>
                )}
                <Text style={styles.sigCaptionUnder}>Firma del paciente</Text>
              </View>
              <View style={styles.sigDivider} />
              <View style={styles.sigColProf}>
                {hasProfSig && profSig ? (
                  <Image src={profSig} style={styles.sigImgProf} />
                ) : null}
              </View>
            </View>
          </View>
        </View>

        <ArisPdfFooter />
      </Page>
    </Document>
  );
}
