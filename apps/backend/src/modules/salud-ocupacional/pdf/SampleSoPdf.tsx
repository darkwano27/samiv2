/**
 * Ejemplo de plantilla PDF del módulo SO (no usado en rutas aún).
 * Patrón: `Document` → `Page` con estilos de `ArisShell` + contenido propio.
 */

import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
  ArisPdfFooter,
  ArisPdfHeader,
  arisPdfPageStyles,
} from '@core/pdf/components/ArisShell';

export function SampleSoPdfDocument({ line }: { line: string }) {
  return (
    <Document>
      <Page size="A4" style={arisPdfPageStyles.page}>
        <ArisPdfHeader title="Salud ocupacional — ejemplo" />
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 11 }}>{line}</Text>
        </View>
        <ArisPdfFooter />
      </Page>
    </Document>
  );
}
