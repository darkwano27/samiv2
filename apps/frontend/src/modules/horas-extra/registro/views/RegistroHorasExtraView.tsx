import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import {
  Calendar,
  Check,
  ChevronRight,
  ClipboardPaste,
  Clock,
  FolderTree,
  Laptop,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  heCreateBoleta,
  heFetchBoletaDetail,
  heFetchMotivos,
  heFetchSupervisorScope,
  heSearchWorkers,
  heUpdateBoleta,
  type HeSupervisorScopeGroup,
} from '../repository/registro-horas-extra.api-repository';
import { PasteFromExcelModal } from '../components/PasteFromExcelModal';
import {
  addDays,
  inclusiveCalendarDays,
  startOfIsoWeekMonday,
  toIsoDateLocal,
} from '../utils/registro-he-dates';

type PeriodPreset =
  | 'hoy'
  | 'manana'
  | 'semana_actual'
  | 'semana_siguiente'
  | 'mes_actual'
  | 'otro';

type GridRow = {
  id: string;
  pernr: string;
  name: string;
  validFrom: string;
  validTo: string;
  days: number;
  timeStart: string;
  timeEnd: string;
  motivoCode: string;
  observaciones: string;
  resolved: boolean;
  /** Búsqueda terminó sin colaborador en alcance (mostrar “No encontrado”). */
  sapNotFound?: boolean;
};

function newRow(defaults: Partial<GridRow>): GridRow {
  return {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    pernr: '',
    name: '',
    validFrom: '',
    validTo: '',
    days: 1,
    timeStart: '08:00',
    timeEnd: '18:00',
    motivoCode: '',
    observaciones: '',
    resolved: false,
    sapNotFound: false,
    ...defaults,
  };
}

function normTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t.trim());
  if (!m) return '08:00';
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}

type KyJsonErr = {
  message?: string | string[];
  errors?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
};

function formatKyValidationMessage(j: KyJsonErr): string | null {
  const raw = j.message;
  const base =
    typeof raw === 'string'
      ? raw
      : Array.isArray(raw)
        ? raw.filter(Boolean).join(' ')
        : '';
  const fe = j.errors?.fieldErrors;
  if (fe && typeof fe === 'object') {
    const parts: string[] = [];
    for (const [k, arr] of Object.entries(fe)) {
      if (Array.isArray(arr) && arr.length) parts.push(`${k}: ${arr.join(', ')}`);
    }
    if (parts.length) return base ? `${base} (${parts.join('; ')})` : parts.join('; ');
  }
  const formErrs = j.errors?.formErrors;
  if (Array.isArray(formErrs) && formErrs.length) {
    const tail = formErrs.join('; ');
    return base ? `${base} (${tail})` : tail;
  }
  return base || null;
}

async function kyErrorMessage(e: unknown): Promise<string> {
  if (e instanceof HTTPError) {
    try {
      const j = (await e.response.json()) as KyJsonErr;
      const formatted = formatKyValidationMessage(j);
      if (formatted) return formatted;
    } catch {
      /* ignore */
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return 'Algo salió mal. Probá de nuevo o avisá a sistemas si se repite.';
}

const PERIOD_OPTIONS: { id: PeriodPreset; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'manana', label: 'Mañana' },
  { id: 'semana_actual', label: 'Semana actual' },
  { id: 'semana_siguiente', label: 'Semana siguiente' },
  { id: 'mes_actual', label: 'Mes actual' },
  { id: 'otro', label: 'Otro periodo' },
];

export type RegistroHorasExtraViewProps = {
  /** Dentro del shell con tabs: sin título principal duplicado. */
  variant?: 'page' | 'embedded';
  /** Tras registrar con éxito (p. ej. volver al tab Bandeja). */
  onAfterBoletaRegistered?: () => void;
  /** UUID de cabecera: carga detalle y abre paso 2 en modo edición. */
  editHeaderId?: string | null;
  /** Tras tomar `editHeaderId` para evitar recargas repetidas. */
  onEditConsumed?: () => void;
};

export function RegistroHorasExtraView({
  variant = 'page',
  onAfterBoletaRegistered,
  editHeaderId = null,
  onEditConsumed,
}: RegistroHorasExtraViewProps = {}) {
  const qc = useQueryClient();
  const scopeQ = useQuery({
    queryKey: ['horas-extra', 'registro', 'supervisor-scope'],
    queryFn: heFetchSupervisorScope,
  });
  const motivosQ = useQuery({
    queryKey: ['horas-extra', 'registro', 'motivos'],
    queryFn: heFetchMotivos,
  });

  const [step, setStep] = useState<1 | 2>(1);
  const [period, setPeriod] = useState<PeriodPreset>('hoy');
  const [validFrom, setValidFrom] = useState(() => toIsoDateLocal(new Date()));
  const [validTo, setValidTo] = useState(() => toIsoDateLocal(new Date()));
  const [groupSlug, setGroupSlug] = useState<string>('');
  const [selectedSubKeys, setSelectedSubKeys] = useState<Set<string>>(() => new Set());
  const [motivoCode, setMotivoCode] = useState('');
  const [rows, setRows] = useState<GridRow[]>(() => [
    newRow({}),
    newRow({}),
    newRow({}),
  ]);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [openLookupRowId, setOpenLookupRowId] = useState<string | null>(null);
  const [lookupQ, setLookupQ] = useState('');
  const [debouncedLookupQ, setDebouncedLookupQ] = useState('');
  const [lookupHits, setLookupHits] = useState<{ sap_code: string; name: string }[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [headerTimeStart, setHeaderTimeStart] = useState<string | undefined>(undefined);
  const [headerTimeEnd, setHeaderTimeEnd] = useState<string | undefined>(undefined);
  const hydratedEditRef = useRef<string | null>(null);

  const detailQ = useQuery({
    queryKey: ['horas-extra', 'registro', 'boleta-detail', editTargetId],
    queryFn: () => heFetchBoletaDetail(editTargetId!),
    enabled: Boolean(editTargetId),
  });

  useEffect(() => {
    if (editHeaderId) {
      setEditTargetId(editHeaderId);
      onEditConsumed?.();
    }
  }, [editHeaderId, onEditConsumed]);

  useEffect(() => {
    if (!editTargetId) hydratedEditRef.current = null;
  }, [editTargetId]);

  useEffect(() => {
    if (!detailQ.data || !editTargetId) return;
    if (detailQ.data.header.id !== editTargetId) return;
    if (hydratedEditRef.current === editTargetId) return;

    const st = (detailQ.data.header.status ?? '').trim().toLowerCase();
    if (st !== 'registrada') {
      window.alert('Solo se pueden editar boletas en estado registrada.');
      setEditTargetId(null);
      hydratedEditRef.current = null;
      return;
    }

    hydratedEditRef.current = editTargetId;
    const d = detailQ.data;
    setGroupSlug(d.header.group_slug);
    setValidFrom(d.header.valid_from);
    setValidTo(d.header.valid_to);
    setPeriod('otro');
    setMotivoCode(d.header.motivo_code ?? '');
    setHeaderTimeStart(d.header.time_start);
    setHeaderTimeEnd(d.header.time_end);
    setSelectedSubKeys(
      new Set(
        d.header.subdivision_pairs.map(
          (p) => `${p.division_code.trim()}|${p.subdivision_code.trim()}`,
        ),
      ),
    );
    setRows(
      d.lines.length > 0
        ? d.lines.map((l) =>
            newRow({
              pernr: l.pernr,
              name: l.worker_name ?? '',
              validFrom: l.valid_from,
              validTo: l.valid_to,
              days: l.days,
              timeStart: l.time_start,
              timeEnd: l.time_end,
              motivoCode: l.motivo_code ?? '',
              observaciones: l.observaciones ?? '',
              resolved: true,
              sapNotFound: false,
            }),
          )
        : [newRow({})],
    );
    setStep(2);
    setSubmitErr(null);
  }, [detailQ.data, editTargetId]);

  const groups = scopeQ.data?.groups ?? [];
  const motivos = motivosQ.data?.items ?? [];

  useEffect(() => {
    if (groups.length === 1 && !groupSlug) {
      setGroupSlug(groups[0]!.slug);
    }
  }, [groups, groupSlug]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedLookupQ(lookupQ), 200);
    return () => clearTimeout(t);
  }, [lookupQ]);

  const activeGroup: HeSupervisorScopeGroup | undefined = useMemo(
    () => groups.find((g) => g.slug === groupSlug),
    [groups, groupSlug],
  );

  const applyPeriod = useCallback((p: PeriodPreset) => {
    const today = new Date();
    if (p === 'hoy') {
      const d = toIsoDateLocal(today);
      setValidFrom(d);
      setValidTo(d);
    } else if (p === 'manana') {
      const t = addDays(today, 1);
      const d = toIsoDateLocal(t);
      setValidFrom(d);
      setValidTo(d);
    } else if (p === 'semana_actual') {
      const start = startOfIsoWeekMonday(today);
      const end = addDays(start, 6);
      setValidFrom(toIsoDateLocal(start));
      setValidTo(toIsoDateLocal(end));
    } else if (p === 'semana_siguiente') {
      const next = addDays(startOfIsoWeekMonday(today), 7);
      const end = addDays(next, 6);
      setValidFrom(toIsoDateLocal(next));
      setValidTo(toIsoDateLocal(end));
    } else if (p === 'mes_actual') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setValidFrom(toIsoDateLocal(start));
      setValidTo(toIsoDateLocal(end));
    }
  }, []);

  useEffect(() => {
    if (period !== 'otro') {
      applyPeriod(period);
    }
  }, [period, applyPeriod]);

  const subKey = (d: string, s: string) => `${d}|${s}`;

  const toggleSub = (division_code: string, subdivision_code: string) => {
    const k = subKey(division_code, subdivision_code);
    setSelectedSubKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const selectedPairs = useMemo(() => {
    if (!activeGroup) return [];
    const out: { division_code: string; subdivision_code: string; name: string | null }[] = [];
    for (const s of activeGroup.subdivisions) {
      if (selectedSubKeys.has(subKey(s.division_code, s.subdivision_code))) {
        out.push({
          division_code: s.division_code,
          subdivision_code: s.subdivision_code,
          name: s.name,
        });
      }
    }
    return out;
  }, [activeGroup, selectedSubKeys]);

  const uniqueDivisionCodes = useMemo(
    () => [...new Set(selectedPairs.map((p) => p.division_code))],
    [selectedPairs],
  );

  const primaryDivisionCode = uniqueDivisionCodes[0] ?? '';
  const subdivisionCodesForSearch = useMemo(
    () => selectedPairs.map((p) => p.subdivision_code),
    [selectedPairs],
  );

  const canContinueStep1 =
    selectedPairs.length > 0 && uniqueDivisionCodes.length === 1 && validFrom && validTo;

  const goStep2 = () => {
    if (!canContinueStep1) return;
    if (uniqueDivisionCodes.length !== 1) {
      window.alert(
        'Elegí subdivisiones que pertenezcan a la misma planta (un solo código de división). Si no estás seguro, pedí ayuda al administrador de WorkForce.',
      );
      return;
    }
    setRows((rs) =>
      rs.map((r) => ({
        ...r,
        validFrom,
        validTo,
        motivoCode,
        days: inclusiveCalendarDays(validFrom, validTo),
      })),
    );
    setStep(2);
    setSubmitErr(null);
  };

  const createM = useMutation({
    mutationFn: heCreateBoleta,
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['horas-extra', 'registro'] });
      void qc.invalidateQueries({ queryKey: ['horas-extra', 'boletas-bandeja'] });
      window.alert(`Listo: boleta N° ${data.display_number} registrada.`);
      setStep(1);
      setMotivoCode('');
      setHeaderTimeStart(undefined);
      setHeaderTimeEnd(undefined);
      setRows([newRow({}), newRow({}), newRow({})]);
      onAfterBoletaRegistered?.();
    },
    onError: async (e: unknown) => {
      setSubmitErr(await kyErrorMessage(e));
    },
  });

  const updateM = useMutation({
    mutationFn: (args: { id: string; body: Parameters<typeof heUpdateBoleta>[1] }) =>
      heUpdateBoleta(args.id, args.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['horas-extra', 'registro'] });
      void qc.invalidateQueries({ queryKey: ['horas-extra', 'boletas-bandeja'] });
      void qc.invalidateQueries({ queryKey: ['horas-extra', 'registro', 'boleta-detail'] });
      window.alert('Boleta actualizada.');
      setEditTargetId(null);
      setHeaderTimeStart(undefined);
      setHeaderTimeEnd(undefined);
      hydratedEditRef.current = null;
      setStep(1);
      setMotivoCode('');
      setRows([newRow({}), newRow({}), newRow({})]);
      onAfterBoletaRegistered?.();
    },
    onError: async (e: unknown) => {
      setSubmitErr(await kyErrorMessage(e));
    },
  });

  const resolveWorkerForRow = useCallback(
    async (row: GridRow) => {
      const code = row.pernr.trim();
      if (!code || !primaryDivisionCode || subdivisionCodesForSearch.length === 0) return;
      try {
        const { results } = await heSearchWorkers({
          q: code,
          division_code: primaryDivisionCode,
          subdivision_codes: subdivisionCodesForSearch,
        });
        const exact = results.find((r) => r.sap_code === code);
        if (exact) {
          setRows((rs) =>
            rs.map((x) =>
              x.id === row.id
                ? { ...x, name: exact.name, resolved: true, sapNotFound: false }
                : x,
            ),
          );
        } else if (results.length === 1) {
          const only = results[0]!;
          setRows((rs) =>
            rs.map((x) =>
              x.id === row.id
                ? {
                    ...x,
                    pernr: only.sap_code,
                    name: only.name,
                    resolved: true,
                    sapNotFound: false,
                  }
                : x,
            ),
          );
        } else if (results.length === 0) {
          setRows((rs) =>
            rs.map((x) =>
              x.id === row.id ? { ...x, name: '', resolved: false, sapNotFound: true } : x,
            ),
          );
        } else {
          setRows((rs) =>
            rs.map((x) =>
              x.id === row.id ? { ...x, name: '', resolved: false, sapNotFound: false } : x,
            ),
          );
        }
      } catch {
        setRows((rs) =>
          rs.map((x) =>
            x.id === row.id ? { ...x, name: '', resolved: false, sapNotFound: false } : x,
          ),
        );
      }
    },
    [primaryDivisionCode, subdivisionCodesForSearch],
  );

  useEffect(() => {
    if (!openLookupRowId || !primaryDivisionCode || subdivisionCodesForSearch.length === 0) {
      setLookupHits([]);
      return;
    }
    const q = debouncedLookupQ.trim();
    const isNum = /^\d+$/.test(q);
    if (!isNum && q.length < 2) {
      setLookupHits([]);
      return;
    }
    let cancelled = false;
    setLookupLoading(true);
    void heSearchWorkers({
      q,
      division_code: primaryDivisionCode,
      subdivision_codes: subdivisionCodesForSearch,
    })
      .then((r) => {
        if (!cancelled) setLookupHits(r.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setLookupHits([]);
      })
      .finally(() => {
        if (!cancelled) setLookupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openLookupRowId, debouncedLookupQ, primaryDivisionCode, subdivisionCodesForSearch]);

  const registerBoleta = () => {
    setSubmitErr(null);
    if (!activeGroup || uniqueDivisionCodes.length !== 1) return;
    const unresolved = rows.filter((r) => r.pernr.trim() && !r.resolved);
    if (unresolved.length) {
      window.alert(
        'Falta confirmar a alguna persona: cuando el nombre aparece abajo del código, recién está listo. Revisá las filas que dicen “Pendiente”.',
      );
      return;
    }
    const notFound = rows.filter((r) => r.pernr.trim() && r.sapNotFound);
    if (notFound.length) {
      window.alert(
        'Hay códigos SAP sin colaborador en tus subdivisiones (“No encontrado”). Corregilos o quitá esas filas antes de registrar.',
      );
      return;
    }
    const lines = rows.filter((r) => r.pernr.trim());
    if (lines.length === 0) {
      window.alert('Tenés que cargar al menos una persona con su código SAP.');
      return;
    }
    const motivoCodes = new Set(motivos.map((m) => m.code));
    const lineMotivo = (code: string) => {
      const t = code.trim();
      if (!t) return null;
      return motivoCodes.has(t) ? t : null;
    };
    const linesPayload = lines.map((r) => ({
      pernr: r.pernr.trim(),
      worker_name: r.name.trim() || null,
      valid_from: r.validFrom,
      valid_to: r.validTo,
      days: r.days,
      time_start: normTime(r.timeStart),
      time_end: normTime(r.timeEnd),
      motivo_code: lineMotivo(r.motivoCode),
      observaciones: r.observaciones.trim() || null,
    }));

    if (editTargetId) {
      updateM.mutate({
        id: editTargetId,
        body: {
          group_slug: activeGroup.slug,
          division_code: primaryDivisionCode,
          subdivision_pairs: selectedPairs.map((p) => ({
            division_code: p.division_code,
            subdivision_code: p.subdivision_code,
          })),
          valid_from: validFrom,
          valid_to: validTo,
          time_start: normTime(headerTimeStart ?? '08:00'),
          time_end: normTime(headerTimeEnd ?? '18:00'),
          motivo_code: lineMotivo(motivoCode),
          lines: linesPayload,
        },
      });
      return;
    }

    createM.mutate({
      group_slug: activeGroup.slug,
      division_code: primaryDivisionCode,
      subdivision_pairs: selectedPairs.map((p) => ({
        division_code: p.division_code,
        subdivision_code: p.subdivision_code,
      })),
      valid_from: validFrom,
      valid_to: validTo,
      motivo_code: lineMotivo(motivoCode),
      lines: linesPayload,
    });
  };

  const confirmPasteSapCodes = (sapCodes: string[]) => {
    if (sapCodes.length === 0) return;
    const added = sapCodes.map((pernr) =>
      newRow({
        pernr,
        name: '',
        validFrom,
        validTo,
        days: inclusiveCalendarDays(validFrom, validTo),
        timeStart: '08:00',
        timeEnd: '18:00',
        motivoCode,
        resolved: false,
        sapNotFound: false,
      }),
    );
    setRows((rs) => [...rs, ...added]);
    void Promise.all(added.map((r) => resolveWorkerForRow(r)));
  };

  const selectHitForRow = (rowId: string, hit: { sap_code: string; name: string }) => {
    setRows((rs) =>
      rs.map((x) =>
        x.id === rowId
          ? { ...x, pernr: hit.sap_code, name: hit.name, resolved: true, sapNotFound: false }
          : x,
      ),
    );
    setOpenLookupRowId(null);
    setLookupQ('');
    setLookupHits([]);
  };

  const resolvedCount = rows.filter((r) => r.pernr.trim() && r.resolved).length;

  const existingSapCodes = useMemo(
    () => rows.map((r) => r.pernr.trim()).filter(Boolean),
    [rows],
  );

  const registerBlocked = rows.some((r) => r.pernr.trim() && !r.resolved);

  const summarySubdivLabel =
    selectedPairs.length === 0
      ? '—'
      : selectedPairs.length === 1
        ? `(${selectedPairs[0]!.subdivision_code}) ${selectedPairs[0]!.name?.trim() || 'Sin nombre'}`
        : `${selectedPairs.length} subdivisiones`;

  return (
    <div
      className={cn(
        'mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 md:max-w-6xl',
        variant === 'page' ? 'p-3 sm:p-4' : 'pt-1',
      )}
    >
      {variant === 'page' ? (
        <header className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <Laptop className="h-6 w-6 shrink-0 text-primary" aria-hidden />
            <h1 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
              Boletas Horas Extra
            </h1>
          </div>
          <p className="max-w-prose text-xs text-muted-foreground sm:text-sm">
            Cargá boletas de horas extra de tu equipo según la subdivisión que te corresponde.
          </p>
        </header>
      ) : (
        <p className="text-sm font-medium text-foreground">Registro de boleta</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
              step === 1
                ? 'bg-primary text-primary-foreground'
                : 'bg-emerald-600 text-white',
            )}
          >
            {step === 1 ? '1' : <Check className="h-4 w-4" aria-hidden />}
          </span>
          <span className={cn('font-medium', step === 1 ? 'text-foreground' : 'text-muted-foreground')}>
            Configuración
          </span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
              step === 2
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-muted text-muted-foreground',
            )}
          >
            2
          </span>
          <span className={cn('font-medium', step === 2 ? 'text-foreground' : 'text-muted-foreground')}>
            Registro de colaboradores
          </span>
        </div>
      </div>

      {scopeQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando las subdivisiones que puedes usar…</p>
      ) : scopeQ.isError ? (
        <p className="text-sm text-destructive">
          No pudimos cargar la información. Actualizá la página o avisá a sistemas si sigue igual.
        </p>
      ) : groups.length === 0 ? (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">No hay subdivisiones disponibles</CardTitle>
            <CardDescription className="text-xs">
              {scopeQ.data?.message ??
                'Pídele a quien administra WorkForce (menú Ajustes) que revise tu usuario.'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : step === 1 ? (
        <Card className="border-border/80 shadow-sm">
          <CardContent className="grid gap-4 p-4 pt-4 sm:grid-cols-2">
            {scopeQ.data?.full_org_access ? (
              <p className="sm:col-span-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-950 dark:text-sky-100">
                Estás viendo <strong>todas</strong> las divisiones y subdivisiones (administrador o
                superadmin). El resto de usuarios solo ve lo que le asignaron en WorkForce.
              </p>
            ) : null}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Clock className="h-4 w-4 text-rose-500" aria-hidden />
                Fechas del periodo — paso 1
              </div>
              <div className="space-y-1">
                {PERIOD_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-2 text-xs leading-tight"
                  >
                    <input
                      type="radio"
                      name="he-period"
                      checked={period === opt.id}
                      onChange={() => setPeriod(opt.id)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label className="text-[10px] uppercase text-muted-foreground">Válido de</Label>
                  <div className="relative">
                    <Input
                      type="date"
                      className="h-8 py-1 text-xs"
                      value={validFrom}
                      onChange={(e) => {
                        setPeriod('otro');
                        setValidFrom(e.target.value);
                      }}
                    />
                    <Calendar className="pointer-events-none absolute right-2 top-1.5 h-3.5 w-3.5 opacity-40" />
                  </div>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] uppercase text-muted-foreground">Válido a</Label>
                  <div className="relative">
                    <Input
                      type="date"
                      className="h-8 py-1 text-xs"
                      value={validTo}
                      onChange={(e) => {
                        setPeriod('otro');
                        setValidTo(e.target.value);
                      }}
                    />
                    <Calendar className="pointer-events-none absolute right-2 top-1.5 h-3.5 w-3.5 opacity-40" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5 rounded-md border border-border/70 p-2.5">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <FolderTree className="h-4 w-4 text-sky-600" aria-hidden />
                  División y subdivisión
                </div>
                {groups.length > 1 ? (
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      División (grupo)
                    </Label>
                    <select
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      value={groupSlug}
                      onChange={(e) => {
                        setGroupSlug(e.target.value);
                        setSelectedSubKeys(new Set());
                      }}
                    >
                      <option value="">Seleccionar…</option>
                      {groups.map((g) => (
                        <option key={g.slug} value={g.slug}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    Subdivisión (puedes marcar varias de esta misma división)
                  </Label>
                  {!activeGroup ? (
                    <p className="text-xs text-muted-foreground">Elegí una división.</p>
                  ) : (
                    <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs">
                      {activeGroup.subdivisions.map((s) => {
                        const k = subKey(s.division_code, s.subdivision_code);
                        const namePart = s.name?.trim() || 'Sin nombre';
                        return (
                          <li key={k}>
                            <label className="flex cursor-pointer items-center gap-2 leading-tight">
                              <input
                                type="checkbox"
                                checked={selectedSubKeys.has(k)}
                                onChange={() => toggleSub(s.division_code, s.subdivision_code)}
                                className="h-3.5 w-3.5 accent-primary"
                              />
                              <span className="text-foreground">
                                ({s.subdivision_code}) {namePart}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 rounded-md border border-border/70 p-2.5">
                <div className="text-sm font-medium">Motivo</div>
                <select
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  value={motivoCode}
                  onChange={(e) => setMotivoCode(e.target.value)}
                  disabled={motivos.length === 0}
                >
                  <option value="">Elegir motivo…</option>
                  {motivos.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] leading-tight text-muted-foreground">
                  Elegí un motivo para copiarlo al paso 2; en cada fila puedes cambiarlo si hace falta.
                </p>
              </div>
            </div>
          </CardContent>
          <div className="flex justify-end border-t border-border/60 px-4 py-2.5">
            <Button
              type="button"
              size="sm"
              className="gap-1"
              disabled={!canContinueStep1}
              onClick={goStep2}
            >
              Continuar
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {editTargetId && detailQ.isLoading ? (
            <p className="text-xs text-muted-foreground">Cargando boleta para edición…</p>
          ) : null}
          {editTargetId && detailQ.data?.header.display_number != null ? (
            <p className="text-xs font-medium text-foreground">
              Editando boleta N° {detailQ.data.header.display_number}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs sm:text-[13px]">
            <span>
              <span className="text-muted-foreground">Fecha:</span>{' '}
              {validFrom === validTo ? validFrom.slice(5) : `${validFrom.slice(5)} → ${validTo.slice(5)}`}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium">{summarySubdivLabel}</span>
            <span className="text-muted-foreground">·</span>
            <span>
              {motivoCode
                ? (motivos.find((m) => m.code === motivoCode)?.label ?? motivoCode)
                : '—'}
            </span>
            <button
              type="button"
              className="ml-auto text-primary underline-offset-2 hover:underline"
              onClick={() => setStep(1)}
            >
              Editar
            </button>
          </div>

          <div className="hidden touch-pan-x overflow-x-auto rounded-md border border-border md:block">
            <table className="w-full min-w-[880px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-[10px] uppercase text-muted-foreground">
                  <th className="px-1.5 py-1.5 font-medium">Código SAP</th>
                  <th className="px-1.5 py-1.5 font-medium">Nombre</th>
                  <th className="px-1.5 py-1.5 font-medium">De</th>
                  <th className="px-1.5 py-1.5 font-medium">A</th>
                  <th className="w-10 px-1 py-1.5 font-medium">Días</th>
                  <th className="px-1 py-1.5 font-medium">Ini</th>
                  <th className="px-1 py-1.5 font-medium">Fin</th>
                  <th className="min-w-[7rem] px-1 py-1.5 font-medium">Motivo</th>
                  <th className="min-w-[6rem] px-1 py-1.5 font-medium">Obs.</th>
                  <th className="w-8 p-1" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/80">
                    <td className="relative p-1 align-top">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-1.5 top-1.5 h-3 w-3 text-muted-foreground" />
                        <Input
                          className="h-7 pl-6 text-xs"
                          placeholder="SAP"
                          value={row.pernr}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRows((rs) =>
                              rs.map((x) =>
                                x.id === row.id
                                  ? { ...x, pernr: v, name: '', resolved: false, sapNotFound: false }
                                  : x,
                              ),
                            );
                            if (openLookupRowId === row.id) setLookupQ(v);
                          }}
                          onFocus={() => {
                            setOpenLookupRowId(row.id);
                            setLookupQ(row.pernr);
                          }}
                          onBlur={(e) => {
                            const v = e.target.value;
                            const rowId = row.id;
                            window.setTimeout(() => {
                              setOpenLookupRowId((cur) => (cur === rowId ? null : cur));
                              void resolveWorkerForRow({ ...row, pernr: v });
                            }, 180);
                          }}
                        />
                        {openLookupRowId === row.id && (lookupHits.length > 0 || lookupLoading) ? (
                          <ul
                            className="absolute z-30 mt-0.5 max-h-36 w-[min(100%,16rem)] overflow-auto rounded border border-border bg-popover py-0.5 shadow-md"
                            role="listbox"
                          >
                            {lookupLoading ? (
                              <li className="px-2 py-1.5 text-muted-foreground">Buscando…</li>
                            ) : (
                              lookupHits.map((h) => (
                                <li key={h.sap_code}>
                                  <button
                                    type="button"
                                    className="w-full px-2 py-1.5 text-left hover:bg-muted"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => selectHitForRow(row.id, h)}
                                  >
                                    <span className="font-medium">{h.name}</span>
                                    <span className="block text-[10px] text-muted-foreground">
                                      SAP {h.sap_code}
                                    </span>
                                  </button>
                                </li>
                              ))
                            )}
                          </ul>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-1 align-top">
                      <div className="min-h-7 rounded border border-transparent px-1 py-1 text-xs leading-tight">
                        {row.name ? (
                          row.name
                        ) : row.sapNotFound ? (
                          <span className="font-medium text-destructive">No encontrado</span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            {row.pernr.trim() ? 'Pendiente' : '—'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-1 align-top">
                      <Input
                        type="date"
                        className="h-7 py-0 text-[11px]"
                        value={row.validFrom}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRows((rs) =>
                            rs.map((x) =>
                              x.id === row.id
                                ? {
                                    ...x,
                                    validFrom: v,
                                    days: inclusiveCalendarDays(v, x.validTo),
                                  }
                                : x,
                            ),
                          );
                        }}
                      />
                    </td>
                    <td className="p-1 align-top">
                      <Input
                        type="date"
                        className="h-7 py-0 text-[11px]"
                        value={row.validTo}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRows((rs) =>
                            rs.map((x) =>
                              x.id === row.id
                                ? {
                                    ...x,
                                    validTo: v,
                                    days: inclusiveCalendarDays(x.validFrom, v),
                                  }
                                : x,
                            ),
                          );
                        }}
                      />
                    </td>
                    <td className="p-1 align-top">
                      <Input
                        type="text"
                        readOnly
                        title="Se calcula solo con las fechas De / A"
                        className="h-7 cursor-default bg-muted/40 py-0 text-center text-xs tabular-nums"
                        value={String(row.days)}
                      />
                    </td>
                    <td className="p-1 align-top">
                      <Input
                        type="time"
                        className="h-7 py-0 text-[11px]"
                        value={row.timeStart}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((x) =>
                              x.id === row.id ? { ...x, timeStart: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="p-1 align-top">
                      <Input
                        type="time"
                        className="h-7 py-0 text-[11px]"
                        value={row.timeEnd}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((x) =>
                              x.id === row.id ? { ...x, timeEnd: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="p-1 align-top">
                      <select
                        className="h-7 w-full rounded-md border border-input bg-background px-1 text-[11px]"
                        value={row.motivoCode}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((x) =>
                              x.id === row.id ? { ...x, motivoCode: e.target.value } : x,
                            ),
                          )
                        }
                      >
                        <option value="">Elegir motivo…</option>
                        {motivos.map((m) => (
                          <option key={m.code} value={m.code}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1 align-top">
                      <Input
                        className="h-7 text-xs"
                        placeholder="Opcional"
                        value={row.observaciones}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((x) =>
                              x.id === row.id ? { ...x, observaciones: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="p-1 align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive"
                        aria-label="Quitar fila"
                        onClick={() =>
                          setRows((rs) => (rs.length <= 1 ? rs : rs.filter((x) => x.id !== row.id)))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden" aria-label="Registro por colaborador (vista móvil)">
            {rows.map((row) => (
              <div
                key={row.id}
                className="space-y-2 rounded-lg border border-border bg-card p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Colaborador
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive"
                    aria-label="Quitar fila"
                    onClick={() =>
                      setRows((rs) => (rs.length <= 1 ? rs : rs.filter((x) => x.id !== row.id)))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Código SAP</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="h-9 pl-8 text-sm"
                      placeholder="SAP"
                      value={row.pernr}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((rs) =>
                          rs.map((x) =>
                            x.id === row.id
                              ? { ...x, pernr: v, name: '', resolved: false, sapNotFound: false }
                              : x,
                          ),
                        );
                        if (openLookupRowId === row.id) setLookupQ(v);
                      }}
                      onFocus={() => {
                        setOpenLookupRowId(row.id);
                        setLookupQ(row.pernr);
                      }}
                      onBlur={(e) => {
                        const v = e.target.value;
                        const rowId = row.id;
                        window.setTimeout(() => {
                          setOpenLookupRowId((cur) => (cur === rowId ? null : cur));
                          void resolveWorkerForRow({ ...row, pernr: v });
                        }, 180);
                      }}
                    />
                    {openLookupRowId === row.id && (lookupHits.length > 0 || lookupLoading) ? (
                      <ul
                        className="absolute z-30 mt-1 max-h-40 w-full overflow-auto rounded-md border border-border bg-popover py-0.5 shadow-md"
                        role="listbox"
                      >
                        {lookupLoading ? (
                          <li className="px-2 py-2 text-sm text-muted-foreground">Buscando…</li>
                        ) : (
                          lookupHits.map((h) => (
                            <li key={h.sap_code}>
                              <button
                                type="button"
                                className="w-full px-2 py-2 text-left text-sm hover:bg-muted"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectHitForRow(row.id, h)}
                              >
                                <span className="font-medium">{h.name}</span>
                                <span className="block text-xs text-muted-foreground">SAP {h.sap_code}</span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-md border border-transparent px-0.5 py-1 text-sm">
                  <span className="text-[10px] uppercase text-muted-foreground">Nombre</span>
                  <div className="mt-0.5">
                    {row.name ? (
                      row.name
                    ) : row.sapNotFound ? (
                      <span className="font-medium text-destructive">No encontrado</span>
                    ) : (
                      <span className="text-muted-foreground italic">
                        {row.pernr.trim() ? 'Pendiente' : '—'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Válido de</Label>
                    <Input
                      type="date"
                      className="h-9 text-sm"
                      value={row.validFrom}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((rs) =>
                          rs.map((x) =>
                            x.id === row.id
                              ? {
                                  ...x,
                                  validFrom: v,
                                  days: inclusiveCalendarDays(v, x.validTo),
                                }
                              : x,
                          ),
                        );
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Válido a</Label>
                    <Input
                      type="date"
                      className="h-9 text-sm"
                      value={row.validTo}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((rs) =>
                          rs.map((x) =>
                            x.id === row.id
                              ? {
                                  ...x,
                                  validTo: v,
                                  days: inclusiveCalendarDays(x.validFrom, v),
                                }
                              : x,
                          ),
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Días</Label>
                    <Input
                      type="text"
                      readOnly
                      title="Se calcula solo con las fechas De / A"
                      className="h-9 cursor-default bg-muted/40 text-center text-sm tabular-nums"
                      value={String(row.days)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Ini</Label>
                    <Input
                      type="time"
                      className="h-9 text-sm"
                      value={row.timeStart}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x) =>
                            x.id === row.id ? { ...x, timeStart: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Fin</Label>
                    <Input
                      type="time"
                      className="h-9 text-sm"
                      value={row.timeEnd}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x) =>
                            x.id === row.id ? { ...x, timeEnd: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Motivo</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={row.motivoCode}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((x) =>
                          x.id === row.id ? { ...x, motivoCode: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    <option value="">Elegir motivo…</option>
                    {motivos.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Observaciones</Label>
                  <Input
                    className="h-9 text-sm"
                    placeholder="Opcional"
                    value={row.observaciones}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((x) =>
                          x.id === row.id ? { ...x, observaciones: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() =>
                setRows((rs) => [
                  ...rs,
                  newRow({
                    validFrom,
                    validTo,
                    days: inclusiveCalendarDays(validFrom, validTo),
                    motivoCode,
                    timeStart: '08:00',
                    timeEnd: '18:00',
                  }),
                ])
              }
            >
              + Agregar fila
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setPasteModalOpen(true)}
            >
              <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
              Pegar desde Excel
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              {resolvedCount} de {rows.length} colaboradores resueltos
            </span>
          </div>
          <p className="max-w-xl text-[11px] leading-snug text-muted-foreground">
            Usá «Pegar desde Excel» para abrir el cuadro de diálogo: pegá con Ctrl+V (no hace falta HTTPS ni
            permiso de portapapeles global). Se agregan filas por cada código válido. En pantallas chicas usá la
            vista en tarjetas; en escritorio, la tabla con desplazamiento horizontal.
          </p>
          {submitErr ? <p className="text-xs text-destructive">{submitErr}</p> : null}

          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
            <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setStep(1)}>
              ← Anterior
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1"
              disabled={(editTargetId ? updateM.isPending : createM.isPending) || registerBlocked}
              onClick={registerBoleta}
            >
              {editTargetId ? 'Guardar cambios' : 'Registrar boleta'}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>

          <PasteFromExcelModal
            open={pasteModalOpen}
            onClose={() => setPasteModalOpen(false)}
            onConfirm={confirmPasteSapCodes}
            existingCodes={existingSapCodes}
          />
        </>
      )}
    </div>
  );
}
