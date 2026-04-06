import type { MeResult } from '@/modules/auth/repository/auth.repository';

export function getGreeting(hour: number): string {
  if (hour >= 5 && hour <= 11) return 'Buenos días';
  if (hour >= 12 && hour <= 17) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Nombre corto para saludo: primer nombre o primera parte de worker_name. */
export function displayFirstName(session: Pick<MeResult, 'workerName'>): string {
  const w = session.workerName?.trim() ?? '';
  if (!w) return '';
  if (w.includes(',')) {
    const after = w.split(',')[1]?.trim();
    if (after) return after.split(/\s+/)[0] ?? after;
  }
  return w.split(/\s+/)[0] ?? w;
}

export function displayFullName(
  session: Pick<MeResult, 'workerName'>,
  firstName: string,
  lastName: string,
): string {
  const combined = `${firstName} ${lastName}`.trim();
  if (combined) return combined;
  return session.workerName?.trim() ?? '';
}

export function getInitials(
  firstName: string,
  lastName: string,
  workerName: string,
): string {
  const f = firstName.trim();
  const l = lastName.trim();
  if (f && l) return `${f[0]!}${l[0]!}`.toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  const w = workerName.trim();
  if (!w) return '?';
  const parts = w.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  }
  return w.slice(0, 2).toUpperCase();
}
