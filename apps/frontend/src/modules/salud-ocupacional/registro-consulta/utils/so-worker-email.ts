import type { SoSapWorker } from '../types/so-consultation.types';

/** Corporativo primero (AD); si no, correo personal (cuenta local). */
export function primaryWorkerEmail(w: SoSapWorker): string {
  return w.emailCorp?.trim() || w.emailPersonal?.trim() || '';
}

export function ccWorkerEmail(w: SoSapWorker): string | null {
  const e = w.emailCorp?.trim() || w.emailPersonal?.trim() || '';
  return e || null;
}
