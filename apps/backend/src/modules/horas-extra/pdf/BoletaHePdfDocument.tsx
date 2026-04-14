/**
 * PDF — Boleta de horas extra aprobada (SAMI / WorkForce), con firma del aprobador (Mi firma).
 */

import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { ArisPdfFooter, ArisPdfHeader, arisPdfPageStyles } from '@core/pdf/components/ArisShell';

const TEAL = '#0d9488';

const styles = StyleSheet.create({
  page: {
    ...arisPdfPageStyles.page,
    paddingTop: 32,
    fontSize: 9,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: TEAL,
    color: '#fff',
    fontSize: 8,
    fontWeight: 700,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  metaItem: { width: '48%', minWidth: 200 },
  metaLabel: { fontSize: 7, color: '#737373', textTransform: 'uppercase', marginBottom: 2 },
  metaVal: { fontSize: 9, color: '#171717' },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: TEAL,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },
  table: { borderWidth: 1, borderColor: '#e5e5e5' },
  th: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  thCell: { fontSize: 6.5, fontWeight: 700, color: '#404040' },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  td: { fontSize: 7, color: '#262626' },
  colSap: { width: '10%' },
  colNom: { width: '22%' },
  colF: { width: '11%' },
  colMot: { width: '24%' },
  colD: { width: '7%' },
  colH: { width: '15%' },
  signBlock: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  signLabel: { fontSize: 8, fontWeight: 700, color: '#404040', marginBottom: 6 },
  signName: { fontSize: 9, marginBottom: 4 },
  signHint: { fontSize: 7, color: '#737373', marginBottom: 6 },
  signImg: { width: 140, height: 48, objectFit: 'contain' as const },
  signLine: {
    marginTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#999',
    width: 200,
    paddingTop: 4,
    fontSize: 7,
    color: '#737373',
  },
});

export type BoletaHePdfLineRow = {
  pernr: string;
  nombre: string;
  desde: string;
  hasta: string;
  dias: number;
  horario: string;
  motivo: string;
};

export type BoletaHePdfDocumentProps = {
  logoSrc?: string;
  displayNumber: number;
  subdivisionLabel: string;
  periodoCabecera: string;
  horarioCabecera: string;
  motivoCabecera: string | null;
  registradoPor: string;
  registradoEl: string;
  aprobadoPor: string | null;
  aprobadoEl: string | null;
  lines: BoletaHePdfLineRow[];
  approverSignatureSrc: string | null;
};

export function BoletaHePdfDocument({
  logoSrc,
  displayNumber,
  subdivisionLabel,
  periodoCabecera,
  horarioCabecera,
  motivoCabecera,
  registradoPor,
  registradoEl,
  aprobadoPor,
  aprobadoEl,
  lines,
  approverSignatureSrc,
}: BoletaHePdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ArisPdfHeader title="WorkForce · Horas extra" logoSrc={logoSrc} />
        <Text style={styles.badge}>Boleta aprobada N° {displayNumber}</Text>
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Subdivisión</Text>
            <Text style={styles.metaVal}>{subdivisionLabel}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Periodo cabecera</Text>
            <Text style={styles.metaVal}>{periodoCabecera}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Horario cabecera</Text>
            <Text style={styles.metaVal}>{horarioCabecera}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Motivo cabecera</Text>
            <Text style={styles.metaVal}>{motivoCabecera ?? '—'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Registrado por</Text>
            <Text style={styles.metaVal}>{registradoPor}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Fecha de registro</Text>
            <Text style={styles.metaVal}>{registradoEl}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Aprobado por</Text>
            <Text style={styles.metaVal}>{aprobadoPor ?? '—'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Fecha de aprobación</Text>
            <Text style={styles.metaVal}>{aprobadoEl ?? '—'}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Líneas</Text>
        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={[styles.thCell, styles.colSap]}>SAP</Text>
            <Text style={[styles.thCell, styles.colNom]}>Nombre</Text>
            <Text style={[styles.thCell, styles.colF]}>Desde</Text>
            <Text style={[styles.thCell, styles.colF]}>Hasta</Text>
            <Text style={[styles.thCell, styles.colD]}>Días</Text>
            <Text style={[styles.thCell, styles.colH]}>Horario</Text>
            <Text style={[styles.thCell, styles.colMot]}>Motivo</Text>
          </View>
          {lines.map((ln, i) => (
            <View key={i} style={styles.tr} wrap={false}>
              <Text style={[styles.td, styles.colSap]}>{ln.pernr}</Text>
              <Text style={[styles.td, styles.colNom]}>{ln.nombre}</Text>
              <Text style={[styles.td, styles.colF]}>{ln.desde}</Text>
              <Text style={[styles.td, styles.colF]}>{ln.hasta}</Text>
              <Text style={[styles.td, styles.colD]}>{ln.dias}</Text>
              <Text style={[styles.td, styles.colH]}>{ln.horario}</Text>
              <Text style={[styles.td, styles.colMot]}>{ln.motivo}</Text>
            </View>
          ))}
        </View>

        <View style={styles.signBlock}>
          <Text style={styles.signLabel}>Firma del aprobador (Mi firma · SAMI)</Text>
          {aprobadoPor ? <Text style={styles.signName}>{aprobadoPor}</Text> : null}
          {approverSignatureSrc ? (
            <Image src={approverSignatureSrc} style={styles.signImg} />
          ) : (
            <Text style={styles.signHint}>
              Sin firma digital cargada en el perfil del aprobador. puedes agregarla en Mi firma.
            </Text>
          )}
          <View style={styles.signLine}>
            <Text>Firma y aclaración</Text>
          </View>
        </View>

        <ArisPdfFooter />
      </Page>
    </Document>
  );
}
