import * as path from 'path';
import { Font } from '@react-pdf/renderer';

let registered = false;

/**
 * Roboto en **TTF** (copiados en `assets/` al compilar).
 * WOFF2 desde URLs provoca errores de fontkit en Node (`Offset is outside the bounds of the DataView`).
 */
export function registerArisPdfFonts(): void {
  if (registered) return;
  const assetsDir = path.join(__dirname, 'assets');
  Font.register({
    family: 'Roboto',
    fonts: [
      {
        src: path.join(assetsDir, 'Roboto-Regular.ttf'),
        fontWeight: 400,
      },
      {
        src: path.join(assetsDir, 'Roboto-Bold.ttf'),
        fontWeight: 700,
      },
    ],
  });
  registered = true;
}
