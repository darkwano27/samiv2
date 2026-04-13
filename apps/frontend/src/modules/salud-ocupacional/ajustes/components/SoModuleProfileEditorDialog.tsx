/**
 * Modal crear/editar perfil SO: acciones por app (read/create/update/delete).
 * El backend resuelve el rol de catálogo que mejor cubre cada app.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  invalidateSoModuleSettingsRelatedQueries,
  readSoModuleSettingsMessage,
  soCreateModuleProfile,
  soDeleteModuleProfile,
  soFetchModuleProfileDetail,
  soFetchProfileActionCatalog,
  soUpdateModuleProfile,
} from '../repository/so-module-settings.api-repository';

const ACTION_UI: Record<string, string> = {
  read: 'Lectura',
  create: 'Creación',
  update: 'Edición',
  delete: 'Eliminación',
};

function actionLabel(slug: string): string {
  return ACTION_UI[slug] ?? slug;
}

type Mode = 'create' | 'edit';

type Props = {
  open: boolean;
  mode: Mode;
  profileId: string | null;
  onClose: () => void;
};

/** app_slug -> acciones marcadas */
type AppActionsState = Record<string, string[]>;

function buildAppPermissionsPayload(state: AppActionsState) {
  return Object.entries(state)
    .filter(([, actions]) => actions.length > 0)
    .map(([app_slug, actions]) => ({ app_slug, actions: [...actions].sort() }));
}

export function SoModuleProfileEditorDialog({ open, mode, profileId, onClose }: Props) {
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [appActions, setAppActions] = useState<AppActionsState>({});
  const [formError, setFormError] = useState<string | null>(null);

  const catalogQ = useQuery({
    queryKey: ['so', 'module-settings', 'profile-action-catalog'],
    queryFn: soFetchProfileActionCatalog,
    enabled: open,
  });

  const detailQ = useQuery({
    queryKey: ['so', 'module-settings', 'module-profile', profileId ?? ''],
    queryFn: () => soFetchModuleProfileDetail(profileId!),
    enabled: open && mode === 'edit' && Boolean(profileId),
  });

  const isSeed = detailQ.data?.is_seed ?? false;

  useEffect(() => {
    if (!open) {
      setFormError(null);
      return;
    }
    if (mode === 'create') {
      setLabel('');
      setDescription('');
      setAppActions({});
      return;
    }
    const d = detailQ.data;
    if (!d) return;
    setLabel(d.label);
    setDescription(d.description ?? '');
    if (d.is_seed) {
      setAppActions({});
      return;
    }
    const next: AppActionsState = {};
    for (const row of d.app_permissions ?? []) {
      next[row.app_slug] = [...row.actions];
    }
    setAppActions(next);
  }, [open, mode, detailQ.data]);

  const toggleAction = useCallback((appSlug: string, action: string) => {
    if (isSeed) return;
    setAppActions((prev) => {
      const cur = new Set(prev[appSlug] ?? []);
      if (cur.has(action)) cur.delete(action);
      else cur.add(action);
      return { ...prev, [appSlug]: [...cur] };
    });
  }, [isSeed]);

  const createM = useMutation({
    mutationFn: soCreateModuleProfile,
    onSuccess: async () => {
      setFormError(null);
      await invalidateSoModuleSettingsRelatedQueries(qc);
      onClose();
    },
    onError: async (e) => {
      setFormError((await readSoModuleSettingsMessage(e)) ?? 'No se pudo crear el perfil.');
    },
  });

  const updateM = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof soUpdateModuleProfile>[1];
    }) => soUpdateModuleProfile(id, body),
    onSuccess: async () => {
      setFormError(null);
      await invalidateSoModuleSettingsRelatedQueries(qc);
      await qc.invalidateQueries({
        queryKey: ['so', 'module-settings', 'module-profile', profileId ?? ''],
      });
      onClose();
    },
    onError: async (e) => {
      setFormError((await readSoModuleSettingsMessage(e)) ?? 'No se pudo guardar el perfil.');
    },
  });

  const deleteM = useMutation({
    mutationFn: () => soDeleteModuleProfile(profileId!),
    onSuccess: async () => {
      setFormError(null);
      await invalidateSoModuleSettingsRelatedQueries(qc);
      onClose();
    },
    onError: async (e) => {
      setFormError((await readSoModuleSettingsMessage(e)) ?? 'No se pudo eliminar el perfil.');
    },
  });

  if (!open) return null;

  const busy = createM.isPending || updateM.isPending || deleteM.isPending;
  const canDelete =
    mode === 'edit' &&
    profileId &&
    detailQ.data &&
    !detailQ.data.is_seed &&
    detailQ.data.member_count === 0;

  function submit() {
    setFormError(null);
    if (!label.trim()) {
      setFormError('El nombre es obligatorio.');
      return;
    }
    const payload = buildAppPermissionsPayload(appActions);
    if (mode === 'create') {
      if (payload.length === 0) {
        setFormError('Marcá al menos una acción en alguna aplicación operativa.');
        return;
      }
      createM.mutate({
        label: label.trim(),
        description: description.trim() || null,
        slug: null,
        app_permissions: payload,
      });
      return;
    }
    if (!profileId) return;
    if (isSeed) {
      updateM.mutate({
        id: profileId,
        body: {
          label: label.trim(),
          description: description.trim() || null,
        },
      });
      return;
    }
    if (payload.length === 0) {
      setFormError('Marcá al menos una acción en alguna aplicación operativa.');
      return;
    }
    updateM.mutate({
      id: profileId,
      body: {
        label: label.trim(),
        description: description.trim() || null,
        app_permissions: payload,
      },
    });
  }

  function confirmDelete() {
    if (
      !canDelete ||
      !window.confirm(
        '¿Eliminar este perfil? Quien ya lo tenga asignado no pierde permisos; solo deja de poder elegirse para personas nuevas.',
      )
    ) {
      return;
    }
    deleteM.mutate();
  }

  const loading = catalogQ.isLoading || (mode === 'edit' && detailQ.isLoading);
  const selectedCount = Object.values(appActions).reduce((n, a) => n + a.length, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="so-profile-editor-title"
        className={cn(
          'flex max-h-[min(100dvh,720px)] w-full max-w-lg flex-col border border-border bg-background shadow-xl',
          'sm:max-h-[90vh] sm:rounded-xl',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 id="so-profile-editor-title" className="font-heading text-lg font-semibold">
            {mode === 'create' ? 'Crear perfil' : 'Editar perfil'}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={busy}
            onClick={() => onClose()}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : catalogQ.isError ? (
            <p className="text-sm text-destructive">
              No se pudo cargar el catálogo de acciones. Intentá de nuevo más tarde.
            </p>
          ) : (
            <div className="space-y-4">
              {isSeed ? (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Este perfil viene con el sistema: Puedes cambiar el nombre y la descripción. Los
                  permisos incluidos están definidos por la instalación.
                </p>
              ) : (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Marcá acciones por aplicación. Por dentro el sistema elige un rol que cubra lo
                  elegido. Si cambiás la plantilla, quien ya tenía el perfil no cambia solo: hace
                  falta volver a aplicar el perfil a esa persona.
                </p>
              )}

              {formError ? (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="so-prof-label">Nombre</Label>
                <Input
                  id="so-prof-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="min-h-11"
                  disabled={busy}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="so-prof-desc">Descripción (opcional)</Label>
                <textarea
                  id="so-prof-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  disabled={busy}
                />
              </div>            

              {!isSeed ? (
                <div className="space-y-2">
                  <Label>Acciones por aplicación</Label>
                  <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border border-border p-3 sm:max-h-80">
                    {(catalogQ.data?.apps ?? []).map((app) => {
                      if (app.is_management) {
                        return (
                          <div
                            key={app.slug}
                            className="rounded-md border border-dashed border-border/80 bg-muted/25 px-3 py-2.5"
                          >
                            <p className="text-sm font-medium text-muted-foreground">{app.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {app.management_note ??
                                'No disponible para perfiles de esta pantalla.'}
                            </p>
                          </div>
                        );
                      }
                      if (app.available_actions.length === 0) {
                        return (
                          <div key={app.slug} className="rounded-md bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                            {app.label}: sin acciones configuradas en catálogo.
                          </div>
                        );
                      }
                      const selected = new Set(appActions[app.slug] ?? []);
                      return (
                        <div
                          key={app.slug}
                          className="space-y-2 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                        >
                          <div>
                            <p className="text-sm font-medium">{app.label}</p>
                            {app.action_scope_note ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {app.action_scope_note}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {app.available_actions.map((action) => (
                              <label
                                key={action}
                                className="flex cursor-pointer items-center gap-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  className="size-4 shrink-0 rounded border-input"
                                  checked={selected.has(action)}
                                  onChange={() => toggleAction(app.slug, action)}
                                  disabled={busy}
                                />
                                <span>{actionLabel(action)}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedCount} acción(es) marcada(s) en total.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {canDelete ? (
            <Button
              type="button"
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
              disabled={busy}
              onClick={() => void confirmDelete()}
            >
              Eliminar perfil
            </Button>
          ) : (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {mode === 'edit' && detailQ.data?.member_count
                ? 'No puedes borrarlo: todavía hay personas con este perfil asignado.'
                : ''}
            </span>
          )}
          <div className="flex flex-1 justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onClose()}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={busy || loading || catalogQ.isError}
              onClick={() => void submit()}
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
