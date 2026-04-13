import { toIsoDateLocal } from '@/modules/horas-extra/registro/utils/registro-he-dates';

/** Desde el día 21 del mes anterior hasta el último día del mes en curso. */
export function defaultBandejaHeaderDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = new Date(y, m - 1, 21);
  const to = new Date(y, m + 1, 0);
  return { dateFrom: toIsoDateLocal(from), dateTo: toIsoDateLocal(to) };
}
