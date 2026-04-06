import * as fs from 'fs';
import * as path from 'path';

/** Logo horizontal ARIS para PDF. Ver `assets/README.md`. */
const LOGO_PREFERRED = 'aris-logo.png';

/** Tamaño máximo del archivo (evita PNG enormes que fallen al decodificar). */
const MAX_LOGO_BYTES = 4 * 1024 * 1024;

function mimeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

/**
 * Rutas candidatas: `dist` (producción), `src` desde cwd del backend, o monorepo root.
 */
function findLogoAbsolutePath(): string | undefined {
  const candidates = [
    path.join(__dirname, 'assets', LOGO_PREFERRED),
    path.join(process.cwd(), 'src', 'core', 'pdf', 'assets', LOGO_PREFERRED),
    path.join(process.cwd(), 'apps', 'backend', 'src', 'core', 'pdf', 'assets', LOGO_PREFERRED),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return path.resolve(p);
  }
  return undefined;
}

/**
 * Ruta absoluta al logo (solo si existe). Útil para logs.
 */
export function resolveSoPdfLogoPath(): string | undefined {
  return findLogoAbsolutePath();
}

/**
 * `src` listo para `<Image src={...} />` en `@react-pdf/renderer` (Node).
 * Usa **data URI** para evitar fallos con rutas Windows y decodificación de archivos locales.
 */
export function getSoPdfLogoImageSrc(): string | undefined {
  const abs = findLogoAbsolutePath();
  if (!abs) return undefined;
  try {
    const buf = fs.readFileSync(abs);
    if (buf.length === 0 || buf.length > MAX_LOGO_BYTES) return undefined;
    const mime = mimeForFile(abs);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return undefined;
  }
}
