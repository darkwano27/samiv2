import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { getRouteApi } from '@tanstack/react-router';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { ChevronDown, FileDown, MoreVertical, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { canDo } from '@/infrastructure/auth/permissions';
import { heFetchSupervisorScope } from '@/modules/horas-extra/registro/repository/registro-horas-extra.api-repository';
import {
  heAprobarBoletaBandeja,
  heAnularBoletaBandeja,
  heDownloadApprovedBoletaPdf,
  heFetchBandejaHeaders,
  heFetchBandejaSubdivisionCatalog,
  type BandejaApiMode,
  type HeBandejaHeaderRow,
} from '../repository/boletas-he-bandeja.api-repository';
import { defaultBandejaHeaderDateRange } from '../utils/bandeja-header-default-range';
import { BoletaHeVerDialog } from './BoletaHeVerDialog';

const authenticatedRouteApi = getRouteApi('/_authenticated');

function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function periodoLabel(vf: string, vt: string): string {
  return vf === vt ? isoToDisplay(vf) : `${isoToDisplay(vf)} – ${isoToDisplay(vt)}`;
}

function effectiveBoletaStatus(raw: string): 'registrada' | 'aprobada' | 'anulada' {
  const s = raw.toLowerCase();
  if (s === 'anulada') return 'anulada';
  if (s === 'aprobada' || s === 'exportada') return 'aprobada';
  return 'registrada';
}

const STATUS_OPTIONS = [
  { value: 'registrada', label: 'Registrada' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'anulada', label: 'Anulada' },
] as const;

function statusBadgeClass(effective: 'registrada' | 'aprobada' | 'anulada'): string {
  if (effective === 'anulada') return 'bg-muted text-muted-foreground';
  if (effective === 'aprobada') return 'bg-sky-100 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100';
  return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100';
}

const selectTriggerClass =
  'h-8 w-full max-w-full rounded-md border border-border bg-background px-2 text-[10px] font-normal text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:text-xs';

export type BandejaBoletasHeViewProps = {
  api: BandejaApiMode;
  /** Solo con shell registro: abre tab registro para editar cabecera/líneas. */
  onEditBoleta?: (headerId: string) => void;
};

async function bandejaKyMessage(e: unknown): Promise<string> {
  if (e instanceof HTTPError) {
    try {
      const j = (await e.response.json()) as { message?: string };
      if (typeof j?.message === 'string') return j.message;
    } catch {
      /* ignore */
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return 'No se pudo completar la acción.';
}

export function BandejaBoletasHeView({ api, onEditBoleta }: BandejaBoletasHeViewProps) {
  const qc = useQueryClient();
  const { session } = authenticatedRouteApi.useRouteContext();
  const isSuperadmin = Boolean(session?.isSuperadmin);
  const canAprobarHe =
    isSuperadmin || canDo(session, 'aprobacion-horas-extra', 'bandeja', 'update');
  const canAnularRegistro = canDo(session, 'registro-horas-extra', 'boletas', 'delete');
  const canAnularAprobacion = canDo(session, 'aprobacion-horas-extra', 'bandeja', 'delete');

  const def = useMemo(() => defaultBandejaHeaderDateRange(), []);
  const [dateFrom, setDateFrom] = useState(def.dateFrom);
  const [dateTo, setDateTo] = useState(def.dateTo);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [workerInput, setWorkerInput] = useState('');
  const [workerQ, setWorkerQ] = useState('');
  const [boletaInput, setBoletaInput] = useState('');
  const [boletaQ, setBoletaQ] = useState('');
  const [creatorInput, setCreatorInput] = useState('');
  const [creatorQ, setCreatorQ] = useState('');
  const [subOptionSearch, setSubOptionSearch] = useState('');
  /** Vacío = todos los estados; si no, un solo valor (combo). */
  const [estadoSelect, setEstadoSelect] = useState<string>('registrada');
  const [subFilter, setSubFilter] = useState<string[]>([]);
  const [verHeaderId, setVerHeaderId] = useState<string | null>(null);
  const [pdfBusyHeaderId, setPdfBusyHeaderId] = useState<string | null>(null);

  const aprobarM = useMutation({
    mutationFn: (headerId: string) => heAprobarBoletaBandeja(headerId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['horas-extra', 'boletas-bandeja'] });
      void qc.invalidateQueries({ queryKey: ['horas-extra', 'boleta-detail'] });
      window.alert('Boleta aprobada.');
    },
    onError: async (e: unknown) => {
      window.alert(await bandejaKyMessage(e));
    },
  });

  const anularM = useMutation({
    mutationFn: (headerId: string) => heAnularBoletaBandeja(api, headerId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['horas-extra', 'boletas-bandeja'] });
      void qc.invalidateQueries({ queryKey: ['horas-extra', 'boleta-detail'] });
      void qc.invalidateQueries({ queryKey: ['horas-extra', 'registro', 'boleta-detail'] });
      window.alert('La boleta quedó anulada.');
    },
    onError: async (e: unknown) => {
      window.alert(await bandejaKyMessage(e));
    },
  });

  useEffect(() => {
    const t = window.setTimeout(() => setWorkerQ(workerInput), 300);
    return () => window.clearTimeout(t);
  }, [workerInput]);

  useEffect(() => {
    const t = window.setTimeout(() => setBoletaQ(boletaInput), 300);
    return () => window.clearTimeout(t);
  }, [boletaInput]);

  useEffect(() => {
    const t = window.setTimeout(() => setCreatorQ(creatorInput), 300);
    return () => window.clearTimeout(t);
  }, [creatorInput]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, workerQ, boletaQ, creatorQ, estadoSelect, subFilter.join(',')]);

  const scopeQ = useQuery({
    queryKey: ['horas-extra', 'registro', 'supervisor-scope'],
    queryFn: heFetchSupervisorScope,
    retry: false,
    enabled: api === 'registro',
  });

  const catalogQ = useQuery({
    queryKey: ['horas-extra', 'aprobacion', 'bandeja-subdivisiones'],
    queryFn: heFetchBandejaSubdivisionCatalog,
    retry: false,
    enabled: api === 'aprobacion',
  });

  const scopeSubNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of scopeQ.data?.groups ?? []) {
      for (const s of g.subdivisions) {
        const c = s.subdivision_code?.trim();
        if (!c || map.has(c)) continue;
        map.set(c, (s.name ?? '').trim());
      }
    }
    return map;
  }, [scopeQ.data]);

  const catalogSubNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of catalogQ.data?.items ?? []) {
      const c = it.subdivision_code.trim();
      if (!map.has(c)) map.set(c, (it.name ?? '').trim());
    }
    return map;
  }, [catalogQ.data]);

  const statusForApi = estadoSelect === '' ? undefined : [estadoSelect];

  const bandejaQ = useQuery({
    queryKey: [
      'horas-extra',
      'boletas-bandeja',
      api,
      dateFrom,
      dateTo,
      page,
      pageSize,
      workerQ,
      boletaQ,
      creatorQ,
      estadoSelect,
      subFilter,
    ],
    queryFn: () =>
      heFetchBandejaHeaders(api, {
        date_from: dateFrom,
        date_to: dateTo,
        page,
        page_size: pageSize,
        worker_q: workerQ || undefined,
        boleta_q: boletaQ || undefined,
        creator_q: creatorQ || undefined,
        status: statusForApi,
        subdivision_codes: subFilter.length ? subFilter : undefined,
      }),
  });

  const items = bandejaQ.data?.items ?? [];
  const total = bandejaQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /** Solo subdivisiones del alcance del usuario (scope registro o catálogo aprobación). */
  const subdivisionFilterCodes = useMemo(() => {
    if (api === 'registro') {
      return [...scopeSubNameByCode.keys()].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    }
    return [...catalogSubNameByCode.keys()].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  }, [api, scopeSubNameByCode, catalogSubNameByCode]);

  const subdivisionRowsForFilter = useMemo(() => {
    const q = subOptionSearch.trim().toLowerCase();
    const nameFor = (code: string) =>
      api === 'registro'
        ? scopeSubNameByCode.get(code) || ''
        : catalogSubNameByCode.get(code) || '';
    return subdivisionFilterCodes
      .map((code) => {
        const name = nameFor(code);
        const line = `${code} ${name}`.toLowerCase();
        return { code, name, line };
      })
      .filter((row) => !q || row.line.includes(q));
  }, [subdivisionFilterCodes, subOptionSearch, api, scopeSubNameByCode, catalogSubNameByCode]);

  const subdivisionSummaryLabel = useMemo(() => {
    if (subFilter.length === 0) return 'Todas las subdivisiones';
    if (subFilter.length === 1) {
      const c = subFilter[0];
      const n =
        api === 'registro'
          ? scopeSubNameByCode.get(c) || ''
          : catalogSubNameByCode.get(c) || '';
      return n ? `${c} — ${n}` : c;
    }
    return `${subFilter.length} subdivisiones`;
  }, [subFilter, api, scopeSubNameByCode, catalogSubNameByCode]);

  const columns = useMemo<ColumnDef<HeBandejaHeaderRow>[]>(
    () => [
      {
        accessorKey: 'display_number',
        header: 'N° Boleta',
        cell: ({ getValue }) => (
          <span className="font-mono font-semibold tabular-nums">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: 'subdivision_label',
        header: 'Subdivisión',
        cell: ({ getValue }) => (
          <span className="max-w-[14rem] text-sm leading-snug break-words sm:max-w-xs">{getValue<string>()}</span>
        ),
      },
      {
        id: 'periodo',
        header: 'Periodo',
        accessorFn: (r) => periodoLabel(r.valid_from, r.valid_to),
        cell: ({ getValue }) => <span className="whitespace-nowrap text-sm">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'line_count',
        header: 'Colaboradores',
        cell: ({ getValue }) => <span className="tabular-nums text-center">{getValue<number>()}</span>,
      },
      {
        accessorKey: 'total_hours',
        header: 'Total horas',
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue<number>().toLocaleString('es-AR')}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          const eff = effectiveBoletaStatus(row.original.status);
          const label = STATUS_OPTIONS.find((o) => o.value === eff)?.label ?? row.original.status;
          return (
            <span
              className={cn(
                'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                statusBadgeClass(eff),
              )}
            >
              {label}
            </span>
          );
        },
      },
      {
        id: 'creado',
        header: 'Creado por',
        accessorFn: (r) => r.created_by_name ?? r.created_by,
        cell: ({ getValue }) => (
          <span className="max-w-[10rem] break-words text-sm sm:max-w-[12rem]">{String(getValue())}</span>
        ),
      },
      {
        id: 'actions',
        header: 'Acción',
        cell: ({ row }) => {
          const eff = effectiveBoletaStatus(row.original.status);
          const canMutateRegistrada = eff === 'registrada';
          const showAprobar = canMutateRegistrada && canAprobarHe;
          const canEdit = Boolean(onEditBoleta) && api === 'registro';
          const canAnular =
            canMutateRegistrada &&
            (api === 'registro' ? canAnularRegistro : canAnularAprobacion);
          const hid = row.original.header_id;
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {showAprobar ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0 px-3 text-xs"
                  disabled={aprobarM.isPending}
                  onClick={() => {
                    if (
                      !window.confirm(`¿Aprobar la boleta N° ${row.original.display_number}?`)
                    ) {
                      return;
                    }
                    aprobarM.mutate(hid);
                  }}
                >
                  Aprobar
                </Button>
              ) : null}
              {eff === 'aprobada' ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={pdfBusyHeaderId === hid}
                  aria-label={`Descargar PDF boleta N° ${row.original.display_number}`}
                  title="Descargar PDF"
                  onClick={() => {
                    void (async () => {
                      setPdfBusyHeaderId(hid);
                      try {
                        await heDownloadApprovedBoletaPdf(api, hid);
                      } catch (e) {
                        window.alert(await bandejaKyMessage(e));
                      } finally {
                        setPdfBusyHeaderId(null);
                      }
                    })();
                  }}
                >
                  <FileDown className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
              <details className="relative inline-block text-left [&_summary::-webkit-details-marker]:hidden">
                <summary
                  className="flex cursor-pointer list-none items-center justify-center rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:bg-muted/60"
                  aria-label="Más acciones"
                >
                  <MoreVertical className="h-4 w-4" aria-hidden />
                </summary>
                <div
                  className="absolute right-0 z-20 mt-1 min-w-[9.5rem] rounded-md border border-border bg-popover py-1 text-xs shadow-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                    onClick={() => setVerHeaderId(hid)}
                  >
                    Ver
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canMutateRegistrada || !canEdit}
                    title={
                      !canEdit
                        ? 'Solo quien tiene perfil de registro (supervisor) puede editar líneas desde acá.'
                        : undefined
                    }
                    onClick={() => {
                      if (canMutateRegistrada && canEdit) onEditBoleta?.(hid);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-destructive hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canAnular || anularM.isPending}
                    onClick={() => {
                      if (!canAnular) return;
                      if (
                        !window.confirm(
                          `¿Anular la boleta N° ${row.original.display_number}? Esta acción la marca como anulada.`,
                        )
                      ) {
                        return;
                      }
                      anularM.mutate(hid);
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </details>
            </div>
          );
        },
      },
    ],
    [
      api,
      onEditBoleta,
      aprobarM.isPending,
      anularM.isPending,
      pdfBusyHeaderId,
      canAprobarHe,
      canAnularRegistro,
      canAnularAprobacion,
    ],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.header_id,
  });

  const toggleSub = (v: string) => {
    setSubFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 sm:gap-4">
      <div
        className="rounded-xl border border-border bg-card p-2 shadow-sm sm:p-3"
        role="search"
        aria-label="Filtros de bandeja"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
          <span className="sr-only">Rango de fechas y búsqueda</span>
          <Label htmlFor="bandeja-desde" className="sr-only">
            Fecha desde
          </Label>
          <Input
            id="bandeja-desde"
            type="date"
            className="h-9 w-[10.5rem] shrink-0"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="shrink-0 text-muted-foreground" aria-hidden>
            →
          </span>
          <Label htmlFor="bandeja-hasta" className="sr-only">
            Fecha hasta
          </Label>
          <Input
            id="bandeja-hasta"
            type="date"
            className="h-9 w-[10.5rem] shrink-0"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 whitespace-nowrap px-3 text-xs"
            onClick={() => {
              const d = defaultBandejaHeaderDateRange();
              setDateFrom(d.dateFrom);
              setDateTo(d.dateTo);
            }}
          >
            Reset
          </Button>
          <div className="relative min-w-[min(100%,16rem)] flex-1 basis-[12rem]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Label htmlFor="bandeja-worker-q" className="sr-only">
              Buscar por SAP o nombre de trabajador
            </Label>
            <Input
              id="bandeja-worker-q"
              className="h-9 w-full pl-8 text-sm"
              placeholder="SAP o nombre…"
              value={workerInput}
              onChange={(e) => setWorkerInput(e.target.value)}
            />
          </div>
        </div>
      </div>

      {bandejaQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : bandejaQ.isError ? (
        <p className="text-sm text-destructive">No se pudo cargar la bandeja.</p>
      ) : (
        <div className="flex min-h-[calc(100dvh-14rem)] flex-1 flex-col gap-3 sm:min-h-[calc(100dvh-11.5rem)]">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="min-h-0 flex-1 overflow-auto [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[720px] table-auto border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {table.getHeaderGroups()[0]?.headers.map((h) => (
                    <th
                      key={h.id}
                      className="min-w-0 align-top px-2 py-1.5 text-[11px] font-medium text-muted-foreground first:pl-3 last:pr-3 sm:px-3 sm:py-2 sm:text-xs"
                    >
                      {h.column.id === 'display_number' ? (
                        <div className="min-w-[6.5rem] space-y-0.5 sm:min-w-[7.5rem]">
                          <span className="block whitespace-nowrap leading-none">N° Boleta</span>
                          <div className="flex min-w-0 items-center gap-1 text-[10px] font-normal normal-case">
                            <Search className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                            <Input
                              className="h-7 min-w-0 flex-1 py-1 text-[10px] sm:h-8"
                              inputMode="numeric"
                              placeholder="Filtrar…"
                              value={boletaInput}
                              onChange={(e) => setBoletaInput(e.target.value)}
                              aria-label="Filtrar por número de boleta"
                            />
                          </div>
                        </div>
                      ) : h.column.id === 'subdivision_label' ? (
                        <div className="min-w-[8.5rem] max-w-[16rem] space-y-0.5 lg:max-w-none lg:min-w-[11rem]">
                          <span className="block whitespace-nowrap leading-none">Subdivisión</span>
                          <details className="group relative z-30">
                            <summary
                              className={cn(
                                'flex h-8 cursor-pointer list-none items-center justify-between gap-1 rounded-md border border-border bg-background px-2 text-left text-[10px] font-normal normal-case sm:h-9 [&::-webkit-details-marker]:hidden',
                              )}
                            >
                              <span className="min-w-0 flex-1 truncate">{subdivisionSummaryLabel}</span>
                              <ChevronDown
                                className="h-3.5 w-3.5 shrink-0 opacity-70 transition-transform group-open:rotate-180"
                                aria-hidden
                              />
                            </summary>
                            <div className="absolute left-0 right-0 z-40 mt-1 max-h-52 overflow-hidden rounded-md border border-border bg-card py-2 shadow-lg">
                              <div className="space-y-2 px-2 pb-2">
                                <Input
                                  className="h-7 text-[10px]"
                                  placeholder="Buscar código o nombre…"
                                  value={subOptionSearch}
                                  onChange={(e) => setSubOptionSearch(e.target.value)}
                                  aria-label="Buscar subdivisión"
                                />
                                <button
                                  type="button"
                                  className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium text-foreground hover:bg-muted"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setSubFilter([]);
                                  }}
                                >
                                  Deseleccionar todo
                                </button>
                              </div>
                              <div className="max-h-40 space-y-0.5 overflow-y-auto px-2 text-[10px] font-normal normal-case">
                                {subdivisionRowsForFilter.length === 0 ? (
                                  <p className="text-muted-foreground">Sin resultados.</p>
                                ) : (
                                  subdivisionRowsForFilter.map(({ code, name }) => (
                                    <label key={code} className="flex cursor-pointer items-start gap-1.5 py-0.5">
                                      <input
                                        type="checkbox"
                                        className="accent-primary mt-0.5 shrink-0"
                                        checked={subFilter.includes(code)}
                                        onChange={() => toggleSub(code)}
                                      />
                                      <span className="min-w-0 leading-tight">
                                        <span className="font-mono">{code}</span>
                                        {name ? (
                                          <>
                                            <span className="text-muted-foreground"> — </span>
                                            <span>{name}</span>
                                          </>
                                        ) : null}
                                      </span>
                                    </label>
                                  ))
                                )}
                              </div>
                            </div>
                          </details>
                        </div>
                      ) : h.column.id === 'status' ? (
                        <div className="min-w-[6.75rem] space-y-0.5">
                          <span className="block whitespace-nowrap leading-none">Estado</span>
                          <select
                            className={selectTriggerClass}
                            value={estadoSelect}
                            onChange={(e) => setEstadoSelect(e.target.value)}
                            aria-label="Filtrar por estado"
                          >
                            <option value="">Todos</option>
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : h.column.id === 'creado' ? (
                        <div className="min-w-[6.5rem] space-y-0.5 sm:min-w-[8rem]">
                          <span className="block whitespace-nowrap leading-none">Creado por</span>
                          <div className="flex min-w-0 items-center gap-1 text-[10px] font-normal normal-case">
                            <Search className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                            <Input
                              className="h-7 min-w-0 flex-1 py-1 text-[10px] sm:h-8"
                              placeholder="Buscar…"
                              value={creatorInput}
                              onChange={(e) => setCreatorInput(e.target.value)}
                              aria-label="Buscar por creador"
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="block whitespace-nowrap pt-1 leading-tight sm:pt-1.5">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No hay boletas con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/70 transition-colors hover:bg-muted/30">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="min-w-0 px-2 py-1.5 align-top first:pl-3 last:pr-3 sm:px-3 sm:py-2">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>

          <div className="flex min-w-0 shrink-0 flex-col gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 break-words">
              Mostrando {items.length ? (page - 1) * pageSize + 1 : 0}–
              {(page - 1) * pageSize + items.length} de {total} boletas
            </span>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="tabular-nums">
                Página {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      )}

      <BoletaHeVerDialog
        open={verHeaderId !== null}
        headerId={verHeaderId}
        api={api}
        onClose={() => setVerHeaderId(null)}
      />
    </div>
  );
}
