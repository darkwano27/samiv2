import { useQuery } from '@tanstack/react-query';
import { Download, Eye, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { HistorialAttendantOption } from '../api/so-historial.api';
import {
  buildHistorialCsvDownloadUrl,
  soFetchConsultationDetail,
  soFetchHistorial,
  soFetchHistorialFilters,
} from '../api/so-historial.api';
import type { SoConsultationDetail } from '../types/so-historial.types';

const HISTORIAL_PAGE_SIZE = 12;

const DISCHARGE: Record<string, string> = {
  observacion: 'En observación',
  recuperado: 'Recuperado',
  derivado: 'Derivado',
};

function currentMonthRangeISO(): { from: string; to: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const last = new Date(y, m + 1, 0);
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  return { from, to };
}

function fmtAttention(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtDateOnly(raw: string | null | undefined): string {
  if (!raw?.trim()) return '—';
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('es-PE', { dateStyle: 'short' });
  }
  return raw.trim();
}

type FilterComboProps = {
  id: string;
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  onFilterChange: () => void;
};

function HistorialFilterCombo({
  id,
  label,
  options,
  value,
  onChange,
  onFilterChange,
}: FilterComboProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const base = q
      ? options.filter((o) => o.toLowerCase().includes(q))
      : options;
    return base.slice(0, 60);
  }, [options, value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="min-w-0 space-y-1" ref={wrapRef}>
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          className="h-8 min-h-8 py-1 text-xs md:text-xs"
          onChange={(e) => {
            onChange(e.target.value);
            onFilterChange();
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar o escribir…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
        />
        {open && filtered.length > 0 ? (
          <ul
            id={`${id}-listbox`}
            role="listbox"
            className="absolute z-50 mt-0.5 max-h-36 w-full overflow-auto rounded-md border border-border bg-background text-xs shadow-md"
          >
            {filtered.map((opt) => (
              <li
                key={opt}
                role="option"
                className="cursor-pointer px-2 py-1.5 hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt);
                  onFilterChange();
                  setOpen(false);
                }}
              >
                {opt}
              </li>
            ))}
          </ul>
        ) : null}
        {open && value.trim() && filtered.length === 0 ? (
          <p
            className="absolute z-50 mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] leading-snug text-muted-foreground shadow-md"
            role="status"
          >
            Sin coincidencias; se filtra con el texto escrito.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function attendantLabelFor(
  attendants: HistorialAttendantOption[],
  createdBy: string,
): string {
  const id = createdBy.trim();
  if (!id) return '—';
  const hit = attendants.find((a) => a.id === id);
  return hit ? `${hit.name} (${id})` : id;
}

function ConsultationDetailPanel({
  detail,
  attendants,
  onClose,
}: {
  detail: SoConsultationDetail;
  attendants: HistorialAttendantOption[];
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const registrado = attendantLabelFor(attendants, detail.createdBy);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="so-hist-detail-title"
        className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2
              id="so-hist-detail-title"
              className="font-heading text-lg font-semibold tracking-tight"
            >
              Consulta Nº {detail.correlative}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {fmtAttention(detail.attentionDate)} · Paciente {detail.patientCod}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Paciente
            </h3>
            <dl className="grid gap-1 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Nombre</dt>
                <dd className="font-medium">{detail.patientName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Documento</dt>
                <dd>{detail.patientDocumentId?.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">División / subdivisión</dt>
                <dd>
                  {[detail.patientDivision, detail.patientSubdivision]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Cargo</dt>
                <dd>{detail.patientPosition?.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sede</dt>
                <dd>{detail.patientEstabl?.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Edad / nacimiento</dt>
                <dd>
                  {detail.patientAge != null ? `${detail.patientAge} años` : '—'} ·{' '}
                  {fmtDateOnly(detail.patientBirthDate ?? null)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Correo</dt>
                <dd className="break-all">{detail.patientEmail?.trim() || '—'}</dd>
              </div>
            </dl>
          </section>

          <section className="mt-6 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Atención
            </h3>
            <dl className="grid gap-1 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Motivo</dt>
                <dd className="whitespace-pre-wrap">{detail.reason?.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Condición de egreso</dt>
                <dd>{DISCHARGE[detail.dischargeCondition] ?? detail.dischargeCondition}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Registrado por</dt>
                <dd>{registrado}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Derivado por</dt>
                <dd>
                  {(() => {
                    const n = detail.referredByName?.trim();
                    const c = detail.referredByCod?.trim();
                    if (n && c) return `${n} (${c})`;
                    return n || c || '—';
                  })()}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Comprobante / envío</dt>
                <dd>
                  {detail.receiptNumber?.trim() || '—'} ·{' '}
                  {detail.emailTo?.trim() || '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="mt-6 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Diagnósticos
            </h3>
            {detail.diagnoses.length === 0 ? (
              <p className="text-muted-foreground">Sin diagnósticos registrados.</p>
            ) : (
              <ul className="list-inside list-disc space-y-1">
                {detail.diagnoses.map((d) => (
                  <li key={d.id}>
                    {d.name}
                    {d.code ? ` (${d.code})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recetas
            </h3>
            {detail.prescriptions.length === 0 ? (
              <p className="text-muted-foreground">Sin medicación registrada.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Medicamento</th>
                      <th className="px-2 py-1.5 font-medium">Presentación</th>
                      <th className="px-2 py-1.5 font-medium">Cant.</th>
                      <th className="px-2 py-1.5 font-medium">Indicaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.prescriptions.map((p) => (
                      <tr key={p.id} className="border-t border-border/60">
                        <td className="px-2 py-1.5 align-top">
                          <span className="font-medium">{p.medicineName}</span>
                          {p.concentration ? (
                            <span className="block text-muted-foreground">{p.concentration}</span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 align-top text-muted-foreground">
                          {[p.presentation, p.administrationRoute, p.frequency, p.duration]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </td>
                        <td className="px-2 py-1.5 align-top font-mono">
                          {p.quantity != null ? p.quantity : '—'}
                        </td>
                        <td className="max-w-[200px] px-2 py-1.5 align-top text-muted-foreground">
                          {p.instructions?.trim() || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export function HistorialMedicoView() {
  const rangeInit = useMemo(() => currentMonthRangeISO(), []);
  const [search, setSearch] = useState('');
  const [division, setDivision] = useState('');
  const [subdivision, setSubdivision] = useState('');
  const [attendedBy, setAttendedBy] = useState('');
  const [dateFrom, setDateFrom] = useState(rangeInit.from);
  const [dateTo, setDateTo] = useState(rangeInit.to);
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const limit = HISTORIAL_PAGE_SIZE;

  const filtersQ = useQuery({
    queryKey: ['so', 'historial', 'filters'],
    queryFn: () => soFetchHistorialFilters(),
  });

  const divisionOptions = filtersQ.data?.divisions ?? [];
  const subdivisionOptions = filtersQ.data?.subdivisions ?? [];
  const attendantOptions = filtersQ.data?.attendants ?? [];

  const searchParam = useMemo(() => {
    const s = search.trim();
    return s.length >= 2 ? s : undefined;
  }, [search]);

  const q = useQuery({
    queryKey: [
      'so',
      'historial',
      searchParam,
      division,
      subdivision,
      attendedBy,
      dateFrom,
      dateTo,
      page,
    ],
    queryFn: () =>
      soFetchHistorial({
        page,
        limit,
        search: searchParam,
        division: division.trim() || undefined,
        subdivision: subdivision.trim() || undefined,
        attendedBy: attendedBy.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const detailQ = useQuery({
    queryKey: ['so', 'consultation', detailId],
    queryFn: () => soFetchConsultationDetail(detailId!),
    enabled: Boolean(detailId),
  });

  async function downloadCsv() {
    const url = buildHistorialCsvDownloadUrl({
      search: searchParam,
      division: division.trim() || undefined,
      subdivision: subdivision.trim() || undefined,
      attendedBy: attendedBy.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'historial-so.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const rows = q.data?.data ?? [];
  const pag = q.data?.pagination;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-3 pb-20 sm:p-4">
      {detailId && detailQ.isPending ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Card className="w-full max-w-sm">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Cargando detalle…
            </CardContent>
          </Card>
        </div>
      ) : null}
      {detailId && detailQ.data ? (
        <ConsultationDetailPanel
          detail={detailQ.data}
          attendants={attendantOptions}
          onClose={() => setDetailId(null)}
        />
      ) : null}
      {detailId && detailQ.isError ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-labelledby="so-hist-err-title"
        >
          <Card className="w-full max-w-sm">
            <CardContent className="space-y-3 pt-6">
              <p id="so-hist-err-title" className="font-medium">
                No se pudo cargar el detalle de la consulta.
              </p>
              <Button type="button" onClick={() => setDetailId(null)}>
                Cerrar
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
        Historial de Atenciones Médicas en Tópico
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          Filtrá consultas y descargá CSV con los mismos criterios.
        </p>
      </div>

      <Card className="overflow-visible border-border/80 shadow-sm">
        <CardContent className="space-y-2 px-3 py-3 sm:px-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7 xl:items-end">
            <div className="col-span-2 min-w-0 sm:col-span-2 lg:col-span-2 xl:col-span-2">
              <Label
                htmlFor="so-hist-search"
                className="text-xs font-normal text-muted-foreground"
              >
                Buscar (nombre o código)
              </Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="so-hist-search"
                  className="h-8 min-h-8 py-1 pl-8 text-xs md:text-xs"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Mín. 2 caracteres…"
                  autoComplete="off"
                />
              </div>
            </div>
            <HistorialFilterCombo
              id="so-hist-div"
              label="División"
              options={divisionOptions}
              value={division}
              onChange={setDivision}
              onFilterChange={() => setPage(1)}
            />
            <HistorialFilterCombo
              id="so-hist-sub"
              label="Subdivisión"
              options={subdivisionOptions}
              value={subdivision}
              onChange={setSubdivision}
              onFilterChange={() => setPage(1)}
            />
            <div className="min-w-0 space-y-1">
              <Label htmlFor="so-hist-att" className="text-xs font-normal text-muted-foreground">
                Atendido por
              </Label>
              <select
                id="so-hist-att"
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={attendedBy}
                onChange={(e) => {
                  setAttendedBy(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                {attendantOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor="so-hist-df" className="text-xs font-normal text-muted-foreground">
                Desde
              </Label>
              <Input
                id="so-hist-df"
                type="date"
                className="h-8 min-h-8 py-1 text-xs md:text-xs"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor="so-hist-dt" className="text-xs font-normal text-muted-foreground">
                Hasta
              </Label>
              <Input
                id="so-hist-dt"
                type="date"
                className="h-8 min-h-8 py-1 text-xs md:text-xs"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs"
              disabled={q.isFetching}
              title="Descargar historial en CSV"
              aria-label="Descargar historial en CSV"
              onClick={() => void downloadCsv()}
            >
              <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
              CSV
            </Button>
            {q.isError ? (
              <span className="text-xs text-destructive">No se pudo cargar el historial.</span>
            ) : null}
            {filtersQ.isError ? (
              <span className="text-xs text-destructive">
                No se pudieron cargar las listas de filtros.
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-border/80">
        <table className="w-full min-w-[940px] text-left text-xs leading-tight">
          <thead className="border-b bg-muted/40 text-[11px] text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-medium">Nº</th>
              <th className="px-2 py-1.5 font-medium">Fecha</th>
              <th className="px-2 py-1.5 font-medium">Paciente</th>
              <th className="px-2 py-1.5 font-medium">Cód.</th>
              <th className="px-2 py-1.5 font-medium">División</th>
              <th className="px-2 py-1.5 font-medium">Subdivisión</th>
              <th className="px-2 py-1.5 font-medium">Cargo</th>
              <th className="px-2 py-1.5 font-medium">Atendido</th>
              <th className="px-2 py-1.5 font-medium">Condición</th>
              <th className="w-10 px-1 py-1.5 text-center font-medium">
                <span className="sr-only">Detalle</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !q.isLoading ? (
              <tr>
                <td colSpan={10} className="px-2 py-6 text-center text-muted-foreground">
                  No hay registros con estos filtros.
                </td>
              </tr>
            ) : null}
            {q.isLoading ? (
              <tr>
                <td colSpan={10} className="px-2 py-6 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="px-2 py-1 font-mono text-[11px] tabular-nums">{r.correlative}</td>
                <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">
                  {fmtAttention(r.attentionDate)}
                </td>
                <td className="max-w-[200px] truncate px-2 py-1 font-medium">{r.patientName}</td>
                <td className="px-2 py-1 font-mono text-[11px] tabular-nums">{r.patientCod}</td>
                <td className="max-w-[120px] truncate px-2 py-1 text-muted-foreground">
                  {r.patientDivision ?? '—'}
                </td>
                <td className="max-w-[120px] truncate px-2 py-1 text-muted-foreground">
                  {r.patientSubdivision ?? '—'}
                </td>
                <td className="max-w-[130px] truncate px-2 py-1 text-muted-foreground">
                  {r.patientPosition ?? '—'}
                </td>
                <td className="max-w-[120px] truncate px-2 py-1 text-muted-foreground">
                  {r.attendedByName ?? '—'}
                </td>
                <td className="whitespace-nowrap px-2 py-1">
                  {DISCHARGE[r.dischargeCondition] ?? r.dischargeCondition}
                </td>
                <td className="px-0.5 py-0.5 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Ver detalle consulta ${r.correlative}`}
                    onClick={() => setDetailId(r.id)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pag && pag.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground sm:text-sm">
          <p className="text-muted-foreground">
            Página {pag.page} de {pag.totalPages} · {pag.total} registro
            {pag.total === 1 ? '' : 's'} · {HISTORIAL_PAGE_SIZE} por página
          </p>
          {pag.totalPages > 1 ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pag.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
