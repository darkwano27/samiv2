import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PenLine, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { SignaturePadModal } from '@/shared/components/SignaturePadModal';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  fetchMeSignature,
  patchMeSignature,
  type MeSignatureDto,
} from '@/modules/auth/repository/user-signature.api-repository';

const authenticatedApi = getRouteApi('/_authenticated');

function mimeFromDataUrl(dataUrl: string): 'image/png' | 'image/jpeg' | 'image/webp' {
  const m = /^data:(image\/(png|jpeg|webp))/i.exec(dataUrl);
  if (m?.[1] === 'image/jpeg') return 'image/jpeg';
  if (m?.[1] === 'image/webp') return 'image/webp';
  return 'image/png';
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    r.readAsDataURL(file);
  });
}

export function MiFirmaView() {
  const { session } = authenticatedApi.useRouteContext();
  const queryClient = useQueryClient();
  const [sigOpen, setSigOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const q = useQuery({
    queryKey: ['auth', 'me-signature'],
    queryFn: fetchMeSignature,
    staleTime: 60_000,
  });

  const patchMut = useMutation({
    mutationFn: patchMeSignature,
    onSuccess: (data: MeSignatureDto) => {
      queryClient.setQueryData(['auth', 'me-signature'], data);
      setFeedback({ ok: true, text: 'Cambios guardados.' });
    },
    onError: () => {
      setFeedback({ ok: false, text: 'No se pudo guardar. Probá de nuevo.' });
    },
  });

  const applyPatch = useCallback(
    (body: Parameters<typeof patchMeSignature>[0]) => {
      setFeedback(null);
      patchMut.mutate(body);
    },
    [patchMut],
  );

  const onUploadStamp = useCallback(
    async (list: FileList | null) => {
      const f = list?.[0];
      if (!f) return;
      const t = (f.type || '').toLowerCase();
      if (t !== 'image/png' && t !== 'image/jpeg' && t !== 'image/webp') {
        setFeedback({ ok: false, text: 'Solo PNG, JPEG o WebP.' });
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(f);
        const mime = mimeFromDataUrl(dataUrl);
        applyPatch({
          uploaded_base64: dataUrl,
          uploaded_mime: mime,
          preferred: 'uploaded',
        });
      } catch {
        setFeedback({ ok: false, text: 'No se pudo leer la imagen.' });
      }
    },
    [applyPatch],
  );

  const data = q.data;
  const busy = patchMut.isPending;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight md:text-2xl">Mi firma</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Firma con el dedo o sube una imagen (sello escaneado).
        </p>
      </div>

      {feedback ? (
        <p
          className={cn(
            'rounded-md border px-3 py-2 text-sm',
            feedback.ok
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
              : 'border-destructive/40 bg-destructive/10 text-destructive',
          )}
          role="status"
        >
          {feedback.text}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vista previa (la que verán los PDFs)</CardTitle>
          <CardDescription>
            Usuario: <span className="font-medium text-foreground">{session.workerName}</span> (SAP{' '}
            {session.sapCode})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">No se pudo cargar tu firma guardada.</p>
          ) : (
            <>
              <div className="flex min-h-[120px] items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-4">
                {data?.effective_data_url ? (
                  <img
                    src={data.effective_data_url}
                    alt="Firma guardada"
                    className="max-h-28 max-w-full object-contain"
                  />
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    Todavía no tienes una  firma guardada.
                  </p>
                )}
              </div>

              {data?.has_drawn && data?.has_uploaded ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Usar en los PDFs</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="mi-firma-pref"
                        className="size-4 accent-primary"
                        checked={data.preferred === 'drawn'}
                        disabled={busy}
                        onChange={() => applyPatch({ preferred: 'drawn' })}
                      />
                      Firma dibujada
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="mi-firma-pref"
                        className="size-4 accent-primary"
                        checked={data.preferred === 'uploaded'}
                        disabled={busy}
                        onChange={() => applyPatch({ preferred: 'uploaded' })}
                      />
                      Imagen / sello subido
                    </label>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={busy}
                  onClick={() => setSigOpen(true)}
                >
                  <PenLine className="h-4 w-4" aria-hidden />
                  Dibujar o cambiar firma
                </Button>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    id="mi-firma-stamp"
                    disabled={busy}
                    onChange={(e) => {
                      void onUploadStamp(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <label
                    htmlFor="mi-firma-stamp"
                    className={cn(
                      buttonVariants({ variant: 'outline' }),
                      'gap-2',
                      busy && 'pointer-events-none opacity-50',
                    )}
                  >
                    <Upload className="h-4 w-4" aria-hidden />
                    Subir imagen o sello
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {data?.has_drawn ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => applyPatch({ drawn_base64: null })}
                  >
                    Eliminar Firma
                  </Button>
                ) : null}
                {data?.has_uploaded ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      applyPatch({ uploaded_base64: null, uploaded_mime: null, preferred: 'drawn' })
                    }
                  >
                    Quitar imagen subida
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <SignaturePadModal
        open={sigOpen}
        onClose={() => setSigOpen(false)}
        onConfirm={(png) => {
          setSigOpen(false);
          applyPatch({ drawn_base64: png, preferred: 'drawn' });
        }}
        title="Tu firma"
        subtitle="Firmá con el dedo o el mouse. Se guarda en tu perfil para los PDFs."
      />
    </div>
  );
}
