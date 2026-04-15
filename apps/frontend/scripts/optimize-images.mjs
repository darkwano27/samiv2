/**
 * Genera WebP (calidad 82) junto a JPG/PNG en `public/` y `src/assets/`.
 * Ejecutar desde `apps/frontend`: `pnpm run optimize:images`
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const EXT = /\.(jpe?g|png)$/i;

async function collectFiles(dir, out = []) {
  let st;
  try {
    st = await stat(dir);
  } catch {
    return out;
  }
  if (!st.isDirectory()) return out;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await collectFiles(full, out);
    } else if (EXT.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const dirs = [path.join(ROOT, 'public'), path.join(ROOT, 'src', 'assets')];
  const files = [];
  for (const d of dirs) {
    await collectFiles(d, files);
  }
  if (files.length === 0) {
    console.log('[optimize:images] No se encontraron JPG/PNG.');
    return;
  }
  let n = 0;
  for (const file of files) {
    const webpPath = file.replace(EXT, '.webp');
    await sharp(file).webp({ quality: 82, effort: 4 }).toFile(webpPath);
    n += 1;
    console.log('[optimize:images]', path.relative(ROOT, file), '→', path.relative(ROOT, webpPath));
  }
  console.log(`[optimize:images] Listo: ${n} archivo(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
