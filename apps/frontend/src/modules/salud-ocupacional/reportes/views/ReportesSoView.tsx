import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { REPORTES_DIVISION_OPTIONS } from '../constants/reportes-divisions';
import { soReportsApi } from '../api/so-reports.api';
import {
  type SoPeriodPreset,
  useSoReportFilters,
} from '../hooks/use-so-report-filters';

const DISCHARGE_COLORS: Record<string, string> = {
  recuperado: '#21a795',
  observacion: '#EF9F27',
  derivado: '#E24B4A',
};

const DISCHARGE_LABELS: Record<string, string> = {
  recuperado: 'Recuperado / Alta',
  observacion: 'En observación',
  derivado: 'Derivado',
};

const STALE = 5 * 60 * 1000;

const TREND_VISIBLE_WEEKS = 10;

type TrendChartRow = {
  weekKey: string;
  weekLabel: string;
  weekLabelLong: string;
  Total: number;
  Recuperado: number;
  Observación: number;
  Derivado: number;
  establishments: { label: string; count: number }[];
};

/** `weekStart` = lunes en `YYYY-MM-DD` (UTC). Etiqueta corta para el eje (menos saturación). */
function formatWeekAxis(weekStart: string): string {
  const [y, mo, d] = weekStart.split('-').map(Number);
  if (!y || !mo || !d) return weekStart;
  const start = new Date(Date.UTC(y, mo - 1, d));
  const nowY = new Date().getFullYear();
  return start.toLocaleDateString(
    'es-PE',
    start.getUTCFullYear() !== nowY
      ? { day: 'numeric', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short' },
  );
}

function formatWeekLong(weekStart: string): string {
  const [y, mo, d] = weekStart.split('-').map(Number);
  if (!y || !mo || !d) return weekStart;
  const start = new Date(Date.UTC(y, mo - 1, d));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const a = start.toLocaleDateString('es-PE', { dateStyle: 'long' });
  const b = end.toLocaleDateString('es-PE', { dateStyle: 'long' });
  return `${a} – ${b}`;
}

function pctPart(n: number, total: number): string {
  if (total <= 0) return '—';
  return `${((n / total) * 100).toFixed(1)}%`;
}

function SoTrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TrendChartRow }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const t = row.Total;
  const line = (label: string, n: number) => (
    <p key={label}>
      <span className="text-muted-foreground">{label}:</span>{' '}
      <span className="font-medium tabular-nums">{n}</span>
      {t > 0 ? (
        <span className="text-muted-foreground"> ({pctPart(n, t)} de la semana)</span>
      ) : null}
    </p>
  );
  return (
    <div className="border-border bg-background max-w-xs rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium capitalize">{row.weekLabelLong}</p>
      {line('Total', row.Total)}
      {line('Recuperado', row.Recuperado)}
      {line('En observación', row.Observación)}
      {line('Derivado', row.Derivado)}
      {row.establishments.length > 0 ? (
        <div className="border-border/80 mt-2 border-t pt-2">
          <p className="text-muted-foreground mb-1 text-[11px] font-medium uppercase tracking-wide">
            Sede
          </p>
          {row.establishments.map((e) => (
            <p key={`${row.weekKey}-${e.label}`}>
              <span className="text-muted-foreground">{e.label}:</span>{' '}
              <span className="font-medium tabular-nums">{e.count}</span>
              {t > 0 ? (
                <span className="text-muted-foreground"> ({pctPart(e.count, t)} de la semana)</span>
              ) : null}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ReportesSoView() {
  const filters = useSoReportFilters();
  const p = filters.params;
  const ps = filters.paramsForSubdivisionOptions;

  const subdivisionsQ = useQuery({
    queryKey: ['so-reports', 'subdivisions', ps],
    queryFn: () => soReportsApi.subdivisions(ps),
    staleTime: STALE,
  });

  const summaryQ = useQuery({
    queryKey: ['so-reports', 'summary', p],
    queryFn: () => soReportsApi.summary(p) as Promise<{
      totalConsultations: number;
      totalConsultationsPrev: number;
      uniqueWorkers: number;
      totalActiveWorkers: number;
      reincidentWorkers: number;
      reincidentRate: number;
      inObservationCount: number;
      inObservationRate: number;
    }>,
    staleTime: STALE,
  });

  const dischargeQ = useQuery({
    queryKey: ['so-reports', 'discharge', p],
    queryFn: () =>
      soReportsApi.dischargeConditions(p) as Promise<{
        conditions: { condition: string; count: number; percentage: number }[];
      }>,
    staleTime: STALE,
  });

  const diagnosesQ = useQuery({
    queryKey: ['so-reports', 'diagnoses', p],
    queryFn: () =>
      soReportsApi.topDiagnoses({ ...p, limit: 5 }) as Promise<{
        diagnoses: { cieCode: string | null; name: string; count: number }[];
      }>,
    staleTime: STALE,
  });

  const divisionsQ = useQuery({
    queryKey: ['so-reports', 'divisions', p],
    queryFn: () =>
      soReportsApi.byDivision(p) as Promise<{
        divisions: {
          divisionCode: string;
          divisionName: string;
          workersCount: number;
          consultationsCount: number;
        }[];
      }>,
    staleTime: STALE,
  });

  const medicationsQ = useQuery({
    queryKey: ['so-reports', 'medications', p],
    queryFn: () =>
      soReportsApi.topMedications({ ...p, limit: 5 }) as Promise<{
        medications: {
          name: string;
          prescriptionCount: number;
          totalUnits: number;
        }[];
      }>,
    staleTime: STALE,
  });

  const patientsQ = useQuery({
    queryKey: ['so-reports', 'patients', p],
    queryFn: () =>
      soReportsApi.topPatients({ ...p, limit: 5 }) as Promise<{
        patients: {
          patientCod: string;
          patientName: string;
          consultationsCount: number;
        }[];
      }>,
    staleTime: STALE,
  });

  const trendQ = useQuery({
    queryKey: ['so-reports', 'trend', p],
    queryFn: () =>
      soReportsApi.trend({ ...p, weeks: 16 }) as Promise<{
        weekly: {
          week: string;
          total: number;
          recuperado: number;
          observacion: number;
          derivado: number;
          establishments?: { label: string; count: number }[];
        }[];
      }>,
    staleTime: STALE,
  });

  const [trendWindowStart, setTrendWindowStart] = useState(0);
  const trendSeriesFull = useMemo((): TrendChartRow[] => {
    return (
      trendQ.data?.weekly.map((w) => ({
        weekKey: w.week,
        weekLabel: formatWeekAxis(w.week),
        weekLabelLong: formatWeekLong(w.week),
        Total: w.total,
        Recuperado: w.recuperado,
        Observación: w.observacion,
        Derivado: w.derivado,
        establishments: w.establishments ?? [],
      })) ?? []
    );
  }, [trendQ.data]);

  const trendMaxStart = Math.max(0, trendSeriesFull.length - TREND_VISIBLE_WEEKS);
  const trendFilterKey = `${p.from ?? ''}|${p.to ?? ''}|${p.division ?? ''}|${p.subdivision ?? ''}`;
  useEffect(() => {
    setTrendWindowStart(0);
  }, [trendFilterKey]);

  useEffect(() => {
    setTrendWindowStart((s) => Math.min(s, trendMaxStart));
  }, [trendMaxStart]);

  const trendWindowStartClamped = Math.min(trendWindowStart, trendMaxStart);
  const chartData = useMemo(() => {
    return trendSeriesFull.slice(
      trendWindowStartClamped,
      trendWindowStartClamped + TREND_VISIBLE_WEEKS,
    );
  }, [trendSeriesFull, trendWindowStartClamped]);

  const pdfMut = useMutation({
    mutationFn: () => soReportsApi.downloadPdf(p),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reporte-salud-ocupacional.pdf';
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const summary = summaryQ.data;
  const deltaPct =
    summary && summary.totalConsultationsPrev > 0
      ? (
          ((summary.totalConsultations - summary.totalConsultationsPrev) /
            summary.totalConsultationsPrev) *
          100
        ).toFixed(1)
      : '—';

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Reportes — Salud ocupacional
        </h1>
        <p className="text-muted-foreground text-sm">
          Indicadores del periodo seleccionado
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:flex-wrap md:items-end">
          <div className="space-y-2">
            <Label>Periodo</Label>
            <select
              className="border-input bg-background h-9 w-full min-w-[200px] rounded-md border px-3 text-sm md:w-56"
              value={filters.preset}
              onChange={(e) => filters.setPreset(e.target.value as SoPeriodPreset)}
            >
              <option value="this_month">Mes actual</option>
              <option value="prev_month">Mes anterior</option>
              <option value="quarter">Último trimestre</option>
              <option value="semester">Último semestre</option>
              <option value="year">Año actual</option>
              <option value="custom">Rango personalizado</option>
            </select>
          </div>
          {filters.preset === 'custom' ? (
            <div className="flex flex-wrap gap-3">
              <div className="space-y-2">
                <Label>Desde</Label>
                <Input
                  type="date"
                  value={
                    filters.customFrom
                      ? filters.customFrom.toISOString().slice(0, 10)
                      : ''
                  }
                  onChange={(e) =>
                    filters.setCustomFrom(
                      e.target.value ? new Date(e.target.value + 'T12:00:00') : null,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Hasta</Label>
                <Input
                  type="date"
                  value={
                    filters.customTo ? filters.customTo.toISOString().slice(0, 10) : ''
                  }
                  onChange={(e) =>
                    filters.setCustomTo(
                      e.target.value ? new Date(e.target.value + 'T12:00:00') : null,
                    )
                  }
                />
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>División</Label>
            <select
              className="border-input bg-background h-9 w-full min-w-[200px] rounded-md border px-3 text-sm md:w-56"
              value={filters.division}
              onChange={(e) => filters.setDivision(e.target.value)}
            >
              <option value="">Todas las divisiones</option>
              {REPORTES_DIVISION_OPTIONS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} — {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Subdivisión</Label>
            <select
              className="border-input bg-background h-9 w-full min-w-[200px] rounded-md border px-3 text-sm md:min-w-[240px] md:w-64"
              value={filters.subdivision}
              onChange={(e) => filters.setSubdivision(e.target.value)}
              disabled={subdivisionsQ.isLoading}
            >
              <option value="">Todas las subdivisiones</option>
              {(subdivisionsQ.data?.subdivisions ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {subdivisionsQ.isError ? (
              <p className="text-destructive text-xs">No se pudieron cargar subdivisiones.</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={pdfMut.isPending}
            onClick={() => pdfMut.mutate()}
          >
            {pdfMut.isPending ? 'Generando…' : 'Exportar PDF'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Atenciones"
          value={summaryQ.isLoading ? '…' : String(summary?.totalConsultations ?? '—')}
          sub={`${deltaPct}% vs periodo anterior`}
        />
        <Kpi
          title="Trabajadores atendidos"
          value={summaryQ.isLoading ? '…' : String(summary?.uniqueWorkers ?? '—')}
          sub={
            summary ? `de ${summary.totalActiveWorkers} activos` : undefined
          }
        />
        <Kpi
          title="Reincidencia"
          value={
            summaryQ.isLoading
              ? '…'
              : summary
                ? `${(summary.reincidentRate * 100).toFixed(1)}%`
                : '—'
          }
          sub={
            summary
              ? 'Pacientes que se atienden más de una vez en el periodo elegido.'
              : undefined
          }
        />
        <Kpi
          title="En observación"
          value={
            summaryQ.isLoading ? '…' : String(summary?.inObservationCount ?? '—')
          }
          sub={
            summary
              ? `${(summary.inObservationRate * 100).toFixed(1)}% del total de atenciones`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Condición al alta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dischargeQ.isLoading ? (
              <p className="text-muted-foreground text-sm">Cargando…</p>
            ) : (
              dischargeQ.data?.conditions.map((c) => (
                <div key={c.condition}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>
                      {DISCHARGE_LABELS[c.condition] ?? c.condition}
                    </span>
                    <span>
                      {c.count} ({c.percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, c.percentage)}%`,
                        backgroundColor:
                          DISCHARGE_COLORS[c.condition] ?? '#94a3b8',
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Top diagnósticos</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="pb-2 pr-2">Diagnóstico</th>
                  <th className="pb-2 text-right">Casos</th>
                </tr>
              </thead>
              <tbody>
                {diagnosesQ.data?.diagnoses.map((d) => (
                  <tr key={d.name} className="border-border/80 border-b">
                    <td className="py-2 pr-2 font-medium">{d.name}</td>
                    <td className="py-2 text-right tabular-nums">{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Top pacientes</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="pb-2 pr-2">Nombre</th>
                  <th className="pb-2 pr-2">Código</th>
                  <th className="pb-2 text-right">Atenc.</th>
                </tr>
              </thead>
              <tbody>
                {(patientsQ.data?.patients ?? []).map((row) => (
                  <tr
                    key={row.patientCod}
                    className="border-border/80 border-b"
                  >
                    <td className="max-w-[140px] truncate py-2 pr-2">{row.patientName}</td>
                    <td className="text-muted-foreground py-2 pr-2 font-mono text-xs">
                      {row.patientCod}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {row.consultationsCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Atenciones por división</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {divisionsQ.data?.divisions.map((d) => {
              const max = Math.max(
                1,
                ...((divisionsQ.data?.divisions.map((x) => x.consultationsCount) ??
                  []) as number[]),
              );
              const pct = (d.consultationsCount / max) * 100;
              return (
                <div key={d.divisionName}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>
                      {d.divisionCode} · {d.workersCount} trabajadores
                    </span>
                    <span>{d.consultationsCount}</span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className="h-2 rounded-full bg-[#21a795]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Medicamentos prescritos</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="pb-2 pr-2">Medicamento</th>
                  <th className="pb-2 text-right">Recetas</th>
                  <th className="pb-2 text-right">Unid.</th>
                </tr>
              </thead>
              <tbody>
                {medicationsQ.data?.medications.map((m) => (
                  <tr key={m.name} className="border-border/80 border-b">
                    <td className="py-2 pr-2">{m.name}</td>
                    <td className="py-2 text-right">{m.prescriptionCount}</td>
                    <td className="py-2 text-right">{m.totalUnits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Tendencia de atenciones</CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">
              Total semanal y condición al alta (cada punto es una semana; lunes a domingo en UTC).
              El cursor muestra cantidades, porcentajes respecto del total de esa semana y sede. Si
              hay más de {TREND_VISIBLE_WEEKS} semanas, usá las flechas para correr la ventana.
            </p>
          </div>
          {trendSeriesFull.length > TREND_VISIBLE_WEEKS ? (
            <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={trendWindowStartClamped <= 0}
                aria-label="Ver semanas anteriores"
                onClick={() =>
                  setTrendWindowStart((s) => Math.max(0, s - 1))
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={trendWindowStartClamped >= trendMaxStart}
                aria-label="Ver semanas siguientes"
                onClick={() =>
                  setTrendWindowStart((s) =>
                    Math.min(
                      Math.max(0, trendSeriesFull.length - TREND_VISIBLE_WEEKS),
                      s + 1,
                    ),
                  )
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="h-[300px] w-full pb-1">
          {chartData.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin datos de tendencia.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fontSize: 10 }}
                  minTickGap={28}
                  interval="preserveStartEnd"
                  angle={-28}
                  textAnchor="end"
                  height={48}
                />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={36} />
                <Tooltip content={<SoTrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="Total"
                  stroke="#21a795"
                  strokeWidth={2}
                  dot={{ r: 2.5, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="Recuperado"
                  stroke="rgba(29,158,117,0.55)"
                  strokeWidth={1.5}
                  dot={{ r: 2, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="Observación"
                  stroke="#EF9F27"
                  strokeWidth={1.5}
                  dot={{ r: 2, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="Derivado"
                  stroke="#E24B4A"
                  strokeWidth={1.5}
                  dot={{ r: 2, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  title,
  value,
  sub,
  hint,
}: {
  title: string;
  value: string;
  sub?: string;
  hint?: string;
}) {
  return (
    <Card className="border-border bg-secondary/40 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {sub ? (
          <p className="text-muted-foreground mt-1 text-xs">{sub}</p>
        ) : null}
        {hint ? (
          <p className="text-muted-foreground mt-2 border-border/60 border-t pt-2 text-[11px] leading-snug">
            {hint}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
