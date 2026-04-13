import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { heFetchBoletaDetailForBandeja, type BandejaApiMode } from '../repository/boletas-he-bandeja.api-repository';

export type BoletaHeVerDialogProps = {
  open: boolean;
  headerId: string | null;
  api: BandejaApiMode;
  onClose: () => void;
};

export function BoletaHeVerDialog({ open, headerId, api, onClose }: BoletaHeVerDialogProps) {
  const q = useQuery({
    queryKey: ['horas-extra', 'boleta-detail', api, headerId],
    queryFn: () => heFetchBoletaDetailForBandeja(api, headerId!),
    enabled: open && Boolean(headerId),
  });

  if (!open || !headerId) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="boleta-ver-title">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="Cerrar" onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(90dvh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <h2 id="boleta-ver-title" className="font-heading text-base font-semibold">
            Boleta HE
            {q.data ? (
              <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
                N° {q.data.header.display_number}
              </span>
            ) : null}
          </h2>
          <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm">
          {q.isLoading ? (
            <p className="text-muted-foreground">Cargando…</p>
          ) : q.isError ? (
            <p className="text-destructive">No se pudo cargar el detalle.</p>
          ) : q.data ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Subdivisión</dt>
                  <dd className="mt-0.5">{q.data.header.subdivision_label}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Periodo cabecera</dt>
                  <dd className="mt-0.5">
                    {q.data.header.valid_from} → {q.data.header.valid_to}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Horario</dt>
                  <dd className="mt-0.5">
                    {q.data.header.time_start} – {q.data.header.time_end}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Motivo (cabecera)</dt>
                  <dd className="mt-0.5">{heMotivoLabel(q.data.header.motivo_code)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Estado</dt>
                  <dd className="mt-0.5 capitalize">{q.data.header.status}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Creado por</dt>
                  <dd className="mt-0.5">{q.data.header.created_by_name ?? q.data.header.created_by}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fecha de registro</dt>
                  <dd className="mt-0.5">{new Date(q.data.header.created_at).toLocaleString('es-AR')}</dd>
                </div>
              </dl>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Líneas</h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-2 py-1.5 font-medium">SAP</th>
                        <th className="px-2 py-1.5 font-medium">Nombre</th>
                        <th className="px-2 py-1.5 font-medium">Desde</th>
                        <th className="px-2 py-1.5 font-medium">Hasta</th>
                        <th className="px-2 py-1.5 font-medium">Días</th>
                        <th className="px-2 py-1.5 font-medium">Horario</th>
                        <th className="px-2 py-1.5 font-medium">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.data.lines.map((l) => (
                        <tr key={l.id} className="border-b border-border/70">
                          <td className="px-2 py-1.5 font-mono">{l.pernr}</td>
                          <td className="px-2 py-1.5">{l.worker_name ?? '—'}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{l.valid_from}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{l.valid_to}</td>
                          <td className="px-2 py-1.5 tabular-nums">{l.days}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap font-mono text-[11px]">
                            {l.time_start}–{l.time_end}
                          </td>
                          <td className="max-w-[10rem] px-2 py-1.5 text-[11px] leading-snug break-words">
                            {heMotivoLabel(l.motivo_code)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="border-t border-border px-4 py-2">
          <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
