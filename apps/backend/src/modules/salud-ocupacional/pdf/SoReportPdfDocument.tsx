/**
 * PDF resumen de métricas SO (reportes). Distinto de la ficha por consulta.
 */

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { ArisPdfFooter, arisPdfPageStyles } from '@core/pdf/components/ArisShell';

const TEAL = '#21a795';

const styles = StyleSheet.create({
  page: {
    ...arisPdfPageStyles.page,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 32,
    fontSize: 9,
  },
  title: { fontSize: 14, fontWeight: 700, color: TEAL, marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#666', marginBottom: 14 },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#0f766e',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: TEAL,
    paddingBottom: 2,
  },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5' },
  cellH: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: '#f0fdfa',
    fontSize: 8,
    fontWeight: 700,
    color: '#134e4a',
  },
  cell: { flex: 1, paddingVertical: 4, paddingHorizontal: 4, fontSize: 8 },
});

export type SoReportPdfKpi = {
  label: string;
  value: string;
};

export type SoReportPdfTable = {
  title: string;
  headers: string[];
  rows: string[][];
};

export type SoReportPdfPayload = {
  periodLabel: string;
  divisionLabel: string;
  kpis: SoReportPdfKpi[];
  tables: SoReportPdfTable[];
};

export function SoReportPdfDocument({ payload }: { payload: SoReportPdfPayload }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Reporte de Salud Ocupacional</Text>
        <Text style={styles.subtitle}>
          Periodo: {payload.periodLabel}
          {' · '}
          División: {payload.divisionLabel}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Indicadores</Text>
          {payload.kpis.map((k) => (
            <View key={k.label} style={styles.row}>
              <Text style={[styles.cell, { flex: 1.2 }]}>{k.label}</Text>
              <Text style={[styles.cell, { fontWeight: 700, color: TEAL }]}>{k.value}</Text>
            </View>
          ))}
        </View>

        {payload.tables.map((t) => (
          <View key={t.title} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{t.title}</Text>
            <View style={styles.row}>
              {t.headers.map((h) => (
                <Text key={h} style={styles.cellH}>
                  {h}
                </Text>
              ))}
            </View>
            {t.rows.map((cells, i) => (
              <View key={i} style={styles.row}>
                {cells.map((c, j) => (
                  <Text key={j} style={styles.cell}>
                    {c}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ))}

        <ArisPdfFooter />
      </Page>
    </Document>
  );
}
