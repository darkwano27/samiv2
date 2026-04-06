import { useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  buildHistorialCsvDownloadUrl,
  soFetchHistorial,
  soFetchHistorialFilters,
} from '../api/so-historial.api';

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
    <div className="space-y-2" ref={wrapRef}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          value={value}
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
            className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-background text-sm shadow-md"
          >
            {filtered.map((opt) => (
              <li
                key={opt}
                role="option"
                className="cursor-pointer px-3 py-2 hover:bg-muted"
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
            className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground shadow-md"
            role="status"
          >
            Sin coincidencias en el catálogo; se filtrará con el texto escrito.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function HistorialMedicoView() {
  const rangeInit = useMemo(() => currentMonthRangeISO(), []);
  const [search, setSearch] = useState('');
  const [division, setDivision] = useState('');
  const [subdivision, setSubdivision] = useState('');
  const [dateFrom, setDateFrom] = useState(rangeInit.from);
  const [dateTo, setDateTo] = useState(rangeInit.to);
  const [page, setPage] = useState(1);
  const limit = 20;

  const filtersQ = useQuery({
    queryKey: ['so', 'historial', 'filters'],
    queryFn: () => soFetchHistorialFilters(),
  });

  const divisionOptions = filtersQ.data?.divisions ?? [];
  const subdivisionOptions = filtersQ.data?.subdivisions ?? [];

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
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  async function downloadCsv() {
    const url = buildHistorialCsvDownloadUrl({
      search: searchParam,
      division: division.trim() || undefined,
      subdivision: subdivision.trim() || undefined,
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 pb-24">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Historial médico
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consultas de salud ocupacional de toda la empresa. Filtrá y descargá CSV con los
          mismos criterios.
        </p>
      </div>

      <Card className="overflow-visible">
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="so-hist-search">Buscar (nombre o SAP)</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="so-hist-search"
                  className="pl-9"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Mínimo 2 caracteres…"
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
            <div className="space-y-2">
              <Label htmlFor="so-hist-df">Desde</Label>
              <Input
                id="so-hist-df"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="so-hist-dt">Hasta</Label>
              <Input
                id="so-hist-dt"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={q.isFetching}
              onClick={() => void downloadCsv()}
            >
              <Download className="h-4 w-4" aria-hidden />
              Descargar CSV
            </Button>
            {q.isError ? (
              <span className="text-sm text-destructive">No se pudo cargar el historial.</span>
            ) : null}
            {filtersQ.isError ? (
              <span className="text-sm text-destructive">
                No se pudieron cargar las listas de división/subdivisión.
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2 font-medium">Nº</th>
              <th className="px-3 py-2 font-medium">Fecha atención</th>
              <th className="px-3 py-2 font-medium">Paciente</th>
              <th className="px-3 py-2 font-medium">SAP</th>
              <th className="px-3 py-2 font-medium">División</th>
              <th className="px-3 py-2 font-medium">Cargo</th>
              <th className="px-3 py-2 font-medium">Condición</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !q.isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No hay registros con estos filtros.
                </td>
              </tr>
            ) : null}
            {q.isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="px-3 py-2 font-mono text-xs">{r.correlative}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtAttention(r.attentionDate)}</td>
                <td className="px-3 py-2">{r.patientName}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.patientCod}</td>
                <td className="max-w-[140px] truncate px-3 py-2 text-muted-foreground">
                  {r.patientDivision ?? '—'}
                </td>
                <td className="max-w-[160px] truncate px-3 py-2 text-muted-foreground">
                  {r.patientPosition ?? '—'}
                </td>
                <td className="px-3 py-2">
                  {DISCHARGE[r.dischargeCondition] ?? r.dischargeCondition}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pag && pag.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            Página {pag.page} de {pag.totalPages} · {pag.total} registros
          </p>
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
        </div>
      ) : null}
    </div>
  );
}
