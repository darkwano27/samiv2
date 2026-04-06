import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const TAG_LEN = 16;

function key32(): Buffer {
  const s = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
  if (!s) {
    throw new Error(
      'SETTINGS_ENCRYPTION_KEY no está definida (necesaria para guardar SMTP por módulo)',
    );
  }
  return createHash('sha256').update(s, 'utf8').digest();
}

/** Cifra un secreto para almacenar en BD (base64). */
export function encryptSettingSecret(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const key = key32();
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/** Descifra un valor guardado con `encryptSettingSecret`. */
export function decryptSettingSecret(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Valor cifrado inválido');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const key = key32();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function isSettingsEncryptionConfigured(): boolean {
  return Boolean(process.env.SETTINGS_ENCRYPTION_KEY?.trim());
}
