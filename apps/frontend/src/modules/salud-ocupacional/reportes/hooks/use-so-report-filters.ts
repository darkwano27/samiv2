import { useMemo, useState } from 'react';
import { endOfMonth, startOfMonth, startOfYear, subMonths, subQuarters } from 'date-fns';

export type SoPeriodPreset =
  | 'this_month'
  | 'prev_month'
  | 'quarter'
  | 'semester'
  | 'year'
  | 'custom';

function rangeForPreset(
  preset: SoPeriodPreset,
  customFrom: Date | null,
  customTo: Date | null,
): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case 'this_month':
      return { from: startOfMonth(now), to: now };
    case 'prev_month': {
      const ref = subMonths(now, 1);
      return { from: startOfMonth(ref), to: endOfMonth(ref) };
    }
    case 'quarter': {
      const from = subQuarters(startOfMonth(now), 1);
      return { from, to: now };
    }
    case 'semester': {
      return { from: subMonths(startOfMonth(now), 5), to: now };
    }
    case 'year':
      return { from: startOfYear(now), to: now };
    case 'custom': {
      const from = customFrom ?? startOfMonth(now);
      const to = customTo ?? now;
      return from.getTime() > to.getTime() ? { from: to, to: from } : { from, to };
    }
    default:
      return { from: startOfMonth(now), to: now };
  }
}

export function useSoReportFilters() {
  const [preset, setPreset] = useState<SoPeriodPreset>('this_month');
  const [division, setDivision] = useState('');
  const [subdivision, setSubdivision] = useState('');
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);

  const { from, to } = useMemo(
    () => rangeForPreset(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const params = useMemo(
    () => ({
      from: from.toISOString(),
      to: to.toISOString(),
      ...(division.trim() ? { division: division.trim() } : {}),
      ...(subdivision.trim() ? { subdivision: subdivision.trim() } : {}),
    }),
    [from, to, division, subdivision],
  );

  /** Params para listar subdivisión (sin el propio filtro de subdivisión). */
  const paramsForSubdivisionOptions = useMemo(
    () => ({
      from: from.toISOString(),
      to: to.toISOString(),
      ...(division.trim() ? { division: division.trim() } : {}),
    }),
    [from, to, division],
  );

  function setDivisionAndResetSub(next: string) {
    setDivision(next);
    setSubdivision('');
  }

  return {
    preset,
    setPreset,
    division,
    setDivision: setDivisionAndResetSub,
    subdivision,
    setSubdivision,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    from,
    to,
    params,
    paramsForSubdivisionOptions,
  };
}
