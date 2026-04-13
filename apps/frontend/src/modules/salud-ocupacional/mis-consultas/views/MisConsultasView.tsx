import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { soFetchMyConsultations } from '../api/so-mis-consultas.api';

const authenticatedRouteApi = getRouteApi('/_authenticated');

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
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

export function MisConsultasView() {
  const { session } = authenticatedRouteApi.useRouteContext();
  const rangeInit = useMemo(() => currentMonthRangeISO(), []);
  const [dateFrom, setDateFrom] = useState(rangeInit.from);
  const [dateTo, setDateTo] = useState(rangeInit.to);
  const [page, setPage] = useState(1);
  const limit = 20;

  const q = useQuery({
    queryKey: ['so', 'mis-consultas', dateFrom, dateTo, page],
    queryFn: () =>
      soFetchMyConsultations({
        page,
        limit,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const rows = q.data?.data ?? [];
  const pag = q.data?.pagination;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 pb-24">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Mis consultas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atenciones en las que figurás como paciente (código{' '}
          <span className="font-mono text-foreground">{session.sapCode}</span>), registradas por
          enfermería en Registro de consulta. No incluye consultas de otras personas. Por defecto se
          filtra el mes en curso.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="so-mine-df">Desde</Label>
              <Input
                id="so-mine-df"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="so-mine-dt">Hasta</Label>
              <Input
                id="so-mine-dt"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          {q.isError ? (
            <p className="text-sm text-destructive">No se pudo cargar el listado.</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2 font-medium">Nº</th>
              <th className="px-3 py-2 font-medium">Fecha atención</th>
              <th className="px-3 py-2 font-medium">Paciente</th>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Motivo</th>
              <th className="px-3 py-2 font-medium">Condición</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !q.isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No hay consultas en este período.
                </td>
              </tr>
            ) : null}
            {q.isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
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
                <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">
                  {r.reason ?? '—'}
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
