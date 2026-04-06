/**
 * Encabezado / pie corporativos ARIS para @react-pdf/renderer.
 * Para logo: añadí `aris-logo.png` en `src/core/pdf/assets/` y usá `ArisPdfHeader` con `logoSrc`.
 */

import { Image, StyleSheet, Text, View } from '@react-pdf/renderer';

export const arisPdfPageStyles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontFamily: 'Roboto',
    fontSize: 10,
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#0d9488',
    paddingBottom: 8,
    marginBottom: 16,
  },
  logoMark: {
    fontSize: 16,
    fontWeight: 700,
    color: '#0f766e',
    marginRight: 10,
  },
  logoImg: { width: 120, height: 32, objectFit: 'contain' as const },
  headerTitle: { fontSize: 11, color: '#444' },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerMuted: { fontSize: 8, color: '#737373' },
});

export function ArisPdfHeader({
  title,
  logoSrc,
}: {
  title?: string;
  /** Ruta absoluta al PNG (p. ej. desde PdfService / assets copiados en build). */
  logoSrc?: string;
}) {
  return (
    <View style={arisPdfPageStyles.header} fixed>
      {logoSrc ? (
        <Image src={logoSrc} style={arisPdfPageStyles.logoImg} />
      ) : (
        <Text style={arisPdfPageStyles.logoMark}>ARIS</Text>
      )}
      <View>
        <Text style={arisPdfPageStyles.headerTitle}>SAMI</Text>
        {title ? (
          <Text style={{ fontSize: 10, marginTop: 2, color: '#525252' }}>{title}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function ArisPdfFooter() {
  return (
    <View style={arisPdfPageStyles.footer} fixed>
      <Text style={arisPdfPageStyles.footerMuted}>Documento generado por SAMI · Confidencial</Text>
      <Text
        style={arisPdfPageStyles.footerMuted}
        render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}
