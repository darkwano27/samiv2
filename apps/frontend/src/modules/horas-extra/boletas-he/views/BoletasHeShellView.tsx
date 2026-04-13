import { ClipboardList, Laptop, PencilLine } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RegistroHorasExtraView } from '@/modules/horas-extra/registro/views/RegistroHorasExtraView';
import { BandejaBoletasHeView } from './BandejaBoletasHeView';

export type BoletasHeShellViewProps = {
  /** Si el usuario solo tiene app de aprobación, no se muestra el tab ni el wizard. */
  showRegistroTab: boolean;
  /** Desde qué API cargar la bandeja (mismo backend, distinto permiso). */
  bandejaApi: 'registro' | 'aprobacion';
};

export function BoletasHeShellView({ showRegistroTab, bandejaApi }: BoletasHeShellViewProps) {
  const [tab, setTab] = useState<'bandeja' | 'registro'>('bandeja');
  const [editBoletaId, setEditBoletaId] = useState<string | null>(null);

  const handleEditBoleta = useCallback((headerId: string) => {
    setEditBoletaId(headerId);
    setTab('registro');
  }, []);

  const clearEditBoleta = useCallback(() => setEditBoletaId(null), []);

  if (!showRegistroTab) {
    return (
      <div className="mx-auto flex min-h-full w-full min-w-0 max-w-full flex-1 flex-col gap-3 px-3 py-3 sm:px-5 sm:py-4 lg:px-8 2xl:max-w-[1800px]">
        <header className="flex min-w-0 shrink-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <Laptop className="h-6 w-6 shrink-0 text-primary" aria-hidden />
            <h1 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
              Boletas Horas Extra
            </h1>
          </div>
          <p className="max-w-prose text-xs text-muted-foreground sm:text-sm">
            Bandeja según las subdivisiones donde estás asignado como aprobador (y permisos de aprobación).
          </p>
        </header>
        <BandejaBoletasHeView api={bandejaApi} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full min-w-0 max-w-full flex-1 flex-col gap-3 px-3 py-3 sm:px-5 sm:py-4 lg:px-8 2xl:max-w-[1800px]">
      <header className="flex min-w-0 shrink-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Laptop className="h-6 w-6 shrink-0 text-primary" aria-hidden />
          <h1 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
            Boletas Horas Extra
          </h1>
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex min-w-0 flex-wrap gap-1" role="tablist" aria-label="Secciones WorkForce">
          <Button
            type="button"
            role="tab"
            aria-selected={tab === 'bandeja'}
            variant={tab === 'bandeja' ? 'secondary' : 'ghost'}
            size="sm"
            className={cn('gap-1.5 rounded-b-none border border-b-0', tab === 'bandeja' && 'border-border bg-muted/60')}
            onClick={() => setTab('bandeja')}
          >
            <ClipboardList className="h-4 w-4" aria-hidden />
            Bandeja de boletas
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={tab === 'registro'}
            variant={tab === 'registro' ? 'secondary' : 'ghost'}
            size="sm"
            className={cn('gap-1.5 rounded-b-none border border-b-0', tab === 'registro' && 'border-border bg-muted/60')}
            onClick={() => setTab('registro')}
          >
            <PencilLine className="h-4 w-4" aria-hidden />
            Registro de boleta
          </Button>
        </div>
        <Button
          type="button"
          size="lg"
          className="h-9 shrink-0 px-4 text-sm"
          onClick={() => {
            setEditBoletaId(null);
            setTab('registro');
          }}
        >
          + Nueva boleta
        </Button>
      </div>

      <div
        role="tabpanel"
        id="panel-bandeja"
        aria-hidden={tab !== 'bandeja'}
        className={cn('flex min-h-0 min-w-0 flex-1 flex-col', tab !== 'bandeja' && 'hidden')}
      >
        <BandejaBoletasHeView api={bandejaApi} onEditBoleta={handleEditBoleta} />
      </div>

      <div
        role="tabpanel"
        id="panel-registro"
        aria-hidden={tab !== 'registro'}
        className={cn('flex min-h-0 min-w-0 flex-1 flex-col', tab !== 'registro' && 'hidden')}
      >
        <RegistroHorasExtraView
          variant="embedded"
          editHeaderId={editBoletaId}
          onEditConsumed={clearEditBoleta}
          onAfterBoletaRegistered={() => setTab('bandeja')}
        />
      </div>
    </div>
  );
}
