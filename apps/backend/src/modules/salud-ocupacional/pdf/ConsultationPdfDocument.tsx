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
    paddingTop: 28,
    paddingHorizontal: 36,
    fontSize: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  /** Caja fija alineada al bloque SAMI; el PNG escala con objectFit. */
  logoWrap: {
    width: 158,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImg: {
    width: 154,
    height: 46,
    objectFit: 'contain' as const,
  },
  brandMark: {
    fontSize: 22,
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
  brandSam: { fontSize: 10, fontWeight: 600, color: '#333' },
  brandSub: { fontSize: 7, color: '#888', marginTop: 1 },
  metaRight: { fontSize: 8, color: '#888', textAlign: 'right' },
  banner: {
    backgroundColor: TEAL,
    paddingVertical: 8,
    marginBottom: 14,
    alignItems: 'center',
  },
  bannerTxt: {
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: 0.8,
  },
  sectionWrap: { marginBottom: 14 },
  tab: {
    alignSelf: 'flex-start',
    backgroundColor: TEAL,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tabTxt: {
    fontSize: 8,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: 0.4,
  },
  box: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    borderTopLeftRadius: 0,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e8e8e8' },
  rowLast: { flexDirection: 'row' },
  cellLabel: {
    width: '28%',
    padding: 6,
    backgroundColor: '#f8f8f8',
    fontSize: 8,
    fontWeight: 700,
    color: '#555',
    borderRightWidth: 0.5,
    borderRightColor: '#e8e8e8',
  },
  cellVal: {
    flex: 1,
    padding: 6,
    fontSize: 9,
    color: '#171717',
    lineHeight: 1.35,
  },
  cellValFull: {
    flex: 1,
    padding: 6,
    fontSize: 9,
    color: '#171717',
    lineHeight: 1.4,
  },
  emailAccent: { color: TEAL },
  /** Fila correo + documento (padding reducido). */
  cellLabelTight: {
    width: '22%',
    paddingVertical: 4,
    paddingHorizontal: 5,
    backgroundColor: '#f8f8f8',
    fontSize: 7,
    fontWeight: 700,
    color: '#555',
    borderRightWidth: 0.5,
    borderRightColor: '#e8e8e8',
  },
  cellValTight: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 8,
    color: '#171717',
    lineHeight: 1.3,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    fontSize: 8,
    fontWeight: 600,
  },
  dxHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e8e8e8',
  },
  dxTh: {
    padding: 5,
    fontSize: 8,
    fontWeight: 700,
    color: '#555',
    borderRightWidth: 0.5,
    borderRightColor: '#e8e8e8',
  },
  dxRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e8e8e8' },
  dxCell: { padding: 5, fontSize: 9, borderRightWidth: 0.5, borderRightColor: '#e8e8e8' },
  dxCode: { fontFamily: 'Roboto', color: TEAL, fontWeight: 600 },
  rxBlock: {
    padding: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e8e8e8',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rxLeft: { flex: 1, paddingRight: 8 },
  rxTitle: { fontSize: 10, fontWeight: 700, color: '#115e59' },
  rxMeta: { fontSize: 8, color: '#666', marginTop: 2 },
  rxInd: {
    marginTop: 3,
    fontSize: 8,
    color: '#888',
    borderLeftWidth: 2,
    borderLeftColor: TEAL,
    paddingLeft: 6,
  },
  rxQty: {
    fontSize: 8,
    backgroundColor: '#e0f2f1',
    color: '#00695c',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 10,
    fontWeight: 600,
  },
  sigCaption: { fontSize: 8, color: '#737373', marginBottom: 4 },
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

type Props = {
  detail: Exclude<ConsultationDetail, null>;
  professionalDisplayName: string;
  /** Ruta absoluta a PNG (p. ej. `resolveSoPdfLogoPath()`). */
  logoSrc?: string;
};

export function ConsultationPdfDocument({
  detail,
  professionalDisplayName,
  logoSrc,
}: Props) {
  const discharge =
    DISCHARGE_LABEL[detail.dischargeCondition] ?? detail.dischargeCondition;

  const sig = detail.signatureData?.trim();
  const hasSig = Boolean(sig && sig.startsWith('data:image'));

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

        {/* 1. Paciente */}
        <View style={styles.sectionWrap}>
          <View style={styles.tab}>
            <Text style={styles.tabTxt}>1. DATOS DEL PACIENTE</Text>
          </View>
          <View style={styles.box}>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>NOMBRE</Text>
              <Text style={styles.cellVal}>{detail.patientName}</Text>
              <Text style={[styles.cellLabel, { width: '22%' }]}>CÓDIGO SAP</Text>
              <Text style={[styles.cellVal, { flex: 0.6 }]}>{detail.patientCod}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>SEDE</Text>
              <Text style={styles.cellVal}>{detail.patientEstabl ?? '—'}</Text>
              <Text style={[styles.cellLabel, { width: '22%' }]}>EDAD</Text>
              <Text style={[styles.cellVal, { flex: 0.6 }]}>
                {detail.patientAge != null ? `${detail.patientAge} años` : '—'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>CARGO</Text>
              <Text style={styles.cellVal}>{detail.patientPosition ?? '—'}</Text>
              <Text style={[styles.cellLabelTight, { width: '18%' }]}>N.º DOC.</Text>
              <Text style={[styles.cellValTight, { flex: 0.55 }]}>
                {detail.patientDocumentId ?? '—'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>DIVISIÓN</Text>
              <Text style={styles.cellVal}>{detail.patientDivision ?? '—'}</Text>
              <Text style={[styles.cellLabel, { width: '22%' }]}>SUBDIVISIÓN</Text>
              <Text style={[styles.cellVal, { flex: 0.6 }]}>
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

        {/* 2. Atención */}
        <View style={styles.sectionWrap}>
          <View style={styles.tab}>
            <Text style={styles.tabTxt}>2. DETALLES DE LA ATENCIÓN</Text>
          </View>
          <View style={styles.box}>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>ATENDIDO POR</Text>
              <Text style={[styles.cellValFull, { borderBottomWidth: 0.5 }]}>
                {professionalDisplayName} (SAP {detail.createdBy})
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>FECHA Y HORA</Text>
              <Text style={styles.cellVal}>{fmtDateTime(detail.attentionDate)}</Text>
              <Text style={[styles.cellLabel, { width: '28%' }]}>CONDICIÓN AL ALTA</Text>
              <View style={[styles.cellVal, { flex: 0.55, justifyContent: 'center' }]}>
                <Text style={styles.badge}>{discharge}</Text>
              </View>
            </View>
            {detail.referredByName || detail.referredByCod ? (
              <View style={styles.row}>
                <Text style={styles.cellLabel}>DERIVADO / REFERIDO POR</Text>
                <Text style={styles.cellValFull}>
                  {[detail.referredByName, detail.referredByCod ? `(SAP ${detail.referredByCod})` : '']
                    .filter(Boolean)
                    .join(' ')}
                </Text>
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
              <Text style={[styles.cellValFull, { minHeight: 36 }]}>{detail.reason ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* 3. Diagnósticos */}
        <View style={styles.sectionWrap}>
          <View style={styles.tab}>
            <Text style={styles.tabTxt}>3. DIAGNÓSTICOS PRESUNTIVOS</Text>
          </View>
          <View style={styles.box}>
            <View style={styles.dxHeader}>
              <Text style={[styles.dxTh, { width: '10%' }]}>#</Text>
              <Text style={[styles.dxTh, { width: '22%' }]}>CIE-10</Text>
              <Text style={[styles.dxTh, { flex: 1, borderRightWidth: 0 }]}>DIAGNÓSTICO</Text>
            </View>
            {detail.diagnoses.length === 0 ? (
              <Text style={{ padding: 8, fontSize: 9, color: '#666' }}>—</Text>
            ) : (
              detail.diagnoses.map((d, i) => (
                <View
                  key={d.id}
                  style={[
                    styles.dxRow,
                    i === detail.diagnoses.length - 1 ? { borderBottomWidth: 0 } : {},
                  ]}
                >
                  <Text style={[styles.dxCell, { width: '10%', textAlign: 'center' }]}>
                    {i + 1}
                  </Text>
                  <Text style={[styles.dxCell, styles.dxCode, { width: '22%', fontSize: 9 }]}>
                    {d.code ?? '—'}
                  </Text>
                  <Text style={[styles.dxCell, { flex: 1, borderRightWidth: 0 }]}>{d.name}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* 4. Prescripción */}
        <View style={styles.sectionWrap}>
          <View style={styles.tab}>
            <Text style={styles.tabTxt}>4. PRESCRIPCIÓN MÉDICA</Text>
          </View>
          <View style={styles.box}>
            {detail.prescriptions.length === 0 ? (
              <Text style={{ padding: 8, fontSize: 9, color: '#666' }}>
                Sin medicación ni insumos registrados.
              </Text>
            ) : (
              detail.prescriptions.map((p, idx) => (
                <View
                  key={p.id}
                  style={[
                    styles.rxBlock,
                    idx === detail.prescriptions.length - 1 ? { borderBottomWidth: 0 } : {},
                  ]}
                >
                  <View style={styles.rxLeft}>
                    <Text style={styles.rxTitle}>{p.medicineName}</Text>
                    <Text style={styles.rxMeta}>
                      {[p.presentation, p.concentration, p.administrationRoute]
                        .filter(Boolean)
                        .join(' · ')}
                      {p.frequency ? ` · ${p.frequency}` : ''}
                      {p.duration ? ` · ${p.duration}` : ''}
                    </Text>
                    {p.instructions ? <Text style={styles.rxInd}>{p.instructions}</Text> : null}
                  </View>
                  <Text style={styles.rxQty}>Cant: {p.quantity}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* 5. Firma */}
        <View style={styles.sectionWrap}>
          <View style={styles.tab}>
            <Text style={styles.tabTxt}>5. FIRMA DEL PACIENTE</Text>
          </View>
          <View style={[styles.box, { padding: 12, alignItems: 'center' }]}>
            {hasSig && sig ? (
              <>
                <Image src={sig} style={{ width: 180, height: 50, objectFit: 'contain' }} />
                <Text style={{ fontSize: 8, color: '#888', marginTop: 4 }}>{detail.patientName}</Text>
                <Text style={{ fontSize: 8, color: '#888' }}>Paciente</Text>
              </>
            ) : (
              <Text style={{ fontSize: 9, color: '#888' }}>Sin firma registrada</Text>
            )}
          </View>
        </View>

        <ArisPdfFooter />
      </Page>
    </Document>
  );
}
