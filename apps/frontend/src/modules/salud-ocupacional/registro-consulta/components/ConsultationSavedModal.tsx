import { CheckCircle2, ClipboardPlus, History } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  open: boolean;
  /** Número de atención visible (correlativo). */
  correlative: number;
  /** Correo del formulario (si hubo). */
  patientEmail: string;
  /** Si se notificó jefatura (segundo correo, sin PDF, con copia al paciente). */
  supervisorEmail?: string;
  onClose: () => void;
  onNewConsultation: () => void;
  onGoHistorial: () => void;
};

export function ConsultationSavedModal({
  open,
  correlative,
  patientEmail,
  supervisorEmail,
  onClose,
  onNewConsultation,
  onGoHistorial,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex min-h-[100dvh] items-center justify-center bg-black/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-[2px]"
      role="presentation"
      onClick={() => onClose()}
    >
      <div
        role="dialog"
        aria-labelledby="so-saved-title"
        aria-modal="true"
        className="max-h-[min(90dvh,calc(100dvh-2rem))] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 text-primary">
            <CheckCircle2 className="h-8 w-8" aria-hidden />
          </div>
          <h2 id="so-saved-title" className="mt-4 font-heading text-xl font-semibold">
            Consulta registrada
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu atención quedó registrada con el número{' '}
            <span className="font-semibold text-foreground">{correlative}</span>.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {patientEmail ? (
              <>
                Enviaremos el PDF de la consulta solo a{' '}
                <span className="break-all font-medium text-foreground">{patientEmail}</span>.
                {supervisorEmail ? (
                  <>
                    {' '}
                    Además, un correo sin adjunto irá a la jefatura (
                    <span className="break-all font-medium text-foreground">
                      {supervisorEmail}
                    </span>
                    ) con copia a ese mismo correo del paciente.
                  </>
                ) : null}
              </>
            ) : supervisorEmail ? (
              <>
                No hay correo del paciente: no se enviará el PDF. Se notificará igual a la
                jefatura (
                <span className="break-all font-medium text-foreground">{supervisorEmail}</span>
                ), sin copia al paciente.
              </>
            ) : (
              'No indicaste correo del paciente ni jefatura: no se enviará notificación por correo.'
            )}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={onNewConsultation}
          >
            <ClipboardPlus className="h-4 w-4 shrink-0" aria-hidden />
            Nueva consulta
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={onGoHistorial}
          >
            <History className="h-4 w-4 shrink-0" aria-hidden />
            Ir al historial
          </Button>
        </div>
      </div>
    </div>
  );
}
