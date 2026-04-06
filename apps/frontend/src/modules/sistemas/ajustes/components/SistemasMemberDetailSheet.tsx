/**
 * Panel lateral — detalle de miembro del módulo Sistemas.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  invalidateSisMemberDetailAndRelated,
  readSisModuleSettingsMessage,
  sisFetchMemberDetail,
  sisFetchModuleProfiles,
  sisReplaceMemberProfile,
  sisRevokeAllInModule,
  sisRevokeAssignmentInModule,
  type SoMemberDetail,
} from '../repository/sistemas-module-settings.api-repository';

const ACTION_LABEL: Record<string, string> = {
  read: 'Lectura',
  create: 'Creación',
  update: 'Edición',
  delete: 'Eliminación',
};

/** Slug de perfil para el selector: prioriza `applied_profile` del backend. */
function inferProfileSlugFromDetail(d: SoMemberDetail): string | null {
  if (d.applied_profile?.slug) return d.applied_profile.slug;
  const s = new Set(d.apps_with_access.map((a) => a.role_slug));
  if (s.has('module-admin')) return 'admin-sistemas';
  return null;
}

function initialsFromName(name: string, fallbackId: string): string {
  const n = name.trim();
  if (n.length >= 2) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const t = fallbackId.trim();
  return t.length >= 2 ? t.slice(-2).toUpperCase() : '?';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

type Props = {
  open: boolean;
  workerId: string | null;
  onClose: () => void;
};

export function SistemasMemberDetailSheet({ open, workerId, onClose }: Props) {
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [profileSlug, setProfileSlug] = useState('');

  const profilesQ = useQuery({
    queryKey: ['sistemas', 'module-settings', 'module-profiles'],
    queryFn: sisFetchModuleProfiles,
    enabled: open,
  });

  const detailQ = useQuery({
    queryKey: ['sistemas', 'module-settings', 'member-detail', workerId ?? ''],
    queryFn: () => sisFetchMemberDetail(workerId!),
    enabled: open && Boolean(workerId),
    retry: false,
  });

  useEffect(() => {
    if (!open) {
      setFormError(null);
    }
  }, [open]);

  useEffect(() => {
    const list = profilesQ.data?.profiles;
    if (!list?.length) return;
    const d = detailQ.data;
    const inferred = d ? inferProfileSlugFromDetail(d) : null;
    setProfileSlug((prev) => {
      if (inferred && list.some((p) => p.slug === inferred)) return inferred;
      if (prev && list.some((p) => p.slug === prev)) return prev;
      return list[0]!.slug;
    });
  }, [profilesQ.data?.profiles, detailQ.data]);

  const invalidateMembers = async () => {
    await invalidateSisMemberDetailAndRelated(qc, workerId);
  };

  const revokeOneM = useMutation({
    mutationFn: (assignmentId: string) => sisRevokeAssignmentInModule(assignmentId),
    onSuccess: async () => {
      setFormError(null);
      await invalidateMembers();
      const r = await detailQ.refetch();
      if (r.error) {
        onClose();
      }
    },
    onError: async (e) => {
      setFormError(
        (await readSisModuleSettingsMessage(e)) ?? 'No se pudo quitar la asignación.',
      );
    },
  });

  const replaceM = useMutation({
    mutationFn: () =>
      sisReplaceMemberProfile(workerId!, profileSlug),
    onSuccess: async () => {
      setFormError(null);
      await invalidateMembers();
      await detailQ.refetch();
    },
    onError: async (e) => {
      setFormError(
        (await readSisModuleSettingsMessage(e)) ?? 'No se pudo cambiar el perfil.',
      );
    },
  });

  const revokeAllM = useMutation({
    mutationFn: () => sisRevokeAllInModule(workerId!),
    onSuccess: async () => {
      setFormError(null);
      onClose();
      await invalidateMembers();
    },
    onError: async (e) => {
      setFormError(
        (await readSisModuleSettingsMessage(e)) ??
          'No se pudo revocar el acceso.',
      );
    },
  });

  function confirmReplace() {
    if (
      !window.confirm(
        'Se quitarán todos los permisos actuales del módulo Sistemas y se aplicará el perfil seleccionado. ¿Continuar?',
      )
    ) {
      return;
    }
    replaceM.mutate();
  }

  function confirmRevoke() {
    if (
      !window.confirm(
        '¿Quitar todo acceso al módulo Sistemas para este trabajador? No podrá usar ninguna app del módulo.',
      )
    ) {
      return;
    }
    revokeAllM.mutate();
  }

  if (!open || !workerId) return null;

  const d: SoMemberDetail | undefined = detailQ.data;
  const busy =
    replaceM.isPending || revokeAllM.isPending || revokeOneM.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sis-member-sheet-title"
        className={cn(
          'flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-xl',
          'animate-in slide-in-from-right duration-200',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="sis-member-sheet-title" className="font-heading text-lg font-semibold">
            Acceso en Sistemas
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
          {detailQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : detailQ.isError ? (
            <p className="text-sm text-destructive">
              No se pudo cargar el detalle. Cierra e intenta de nuevo.
            </p>
          ) : d ? (
            <div className="space-y-6">
              <div className="flex gap-3">
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
                  aria-hidden
                >
                  {initialsFromName(d.display_name, d.worker_id)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{d.display_name}</p>
                  <p className="text-xs text-muted-foreground">Código {d.worker_id}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Asignado el {formatDate(d.assigned_at)}
                  </p>
                  {d.applied_profile?.label ? (
                    <p className="mt-1 text-xs font-medium text-foreground">
                      Perfil: {d.applied_profile.label}
                    </p>
                  ) : null}
                </div>
              </div>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Puede usar — {d.apps_with_access.length}
                </h3>
                <ul className="mt-2 space-y-3">
                  {d.apps_with_access.map((app) => (
                    <li
                      key={app.assignment_id}
                      className="rounded-lg border border-border/80 bg-muted/20 p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-foreground">{app.app_label}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 text-destructive hover:text-destructive"
                          disabled={busy}
                          onClick={() => revokeOneM.mutate(app.assignment_id)}
                        >
                          Quitar
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Rol técnico en la app: {app.role_label}
                      </p>
                      {app.profile_product_actions?.length ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Acciones según el perfil aplicado:
                          </p>
                          <p className="inline-flex flex-wrap gap-1.5">
                            {app.profile_product_actions.map((a) => (
                              <span
                                key={a}
                                className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900 dark:text-emerald-100"
                              >
                                {ACTION_LABEL[a] ?? a}
                              </span>
                            ))}
                          </p>
                        </div>
                      ) : (
                        <ul className="mt-2 space-y-1.5">
                          {app.features.map((f) => (
                            <li key={f.feature_slug} className="text-xs">
                              <span className="text-muted-foreground">Permisos:</span>{' '}
                              <span className="inline-flex flex-wrap gap-1">
                                {(f.actions ?? []).map((a) => (
                                  <span
                                    key={a}
                                    className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-900 dark:text-emerald-100"
                                  >
                                    {ACTION_LABEL[a] ?? a}
                                  </span>
                                ))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  No puede usar (aún) — {d.apps_without_access.length}
                </h3>
                <ul className="mt-2 space-y-2.5">
                  {d.apps_without_access.map((a) => (
                    <li
                      key={a.app_slug}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border/80 px-3 py-2.5 text-sm"
                    >
                      <span className="text-muted-foreground">{a.app_label}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          a.reason === 'solo_admin'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-muted/80 text-muted-foreground',
                        )}
                      >
                        {a.reason === 'solo_admin' ? 'Solo administración' : 'Sin acceso'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {formError ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {formError}
                </p>
              ) : null}

              <section className="space-y-2 border-t border-border pt-4">
                <h3 className="text-sm font-medium">Cambiar perfil</h3>
                <p className="text-xs text-muted-foreground">
                  Selecciona una plantilla de permisos. Al aplicar, se reemplazan los accesos actuales
                  del módulo por los de esa plantilla.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    className="flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring sm:max-w-[220px]"
                    value={profileSlug}
                    disabled={busy || !profilesQ.data?.profiles?.length || profilesQ.isLoading}
                    onChange={(e) => setProfileSlug(e.target.value)}
                  >
                    {(profilesQ.data?.profiles ?? []).map((o) => (
                      <option key={o.id} value={o.slug}>
                        {o.label}
                        {o.is_seed ? ' — sistema' : ''}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    className="min-h-11 bg-primary"
                    disabled={
                      busy ||
                      !profileSlug ||
                      profilesQ.isLoading ||
                      !profilesQ.data?.profiles?.length
                    }
                    onClick={() => confirmReplace()}
                  >
                    {replaceM.isPending ? 'Aplicando…' : 'Aplicar'}
                  </Button>
                </div>
              </section>

              <div className="border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                  disabled={busy}
                  onClick={() => confirmRevoke()}
                >
                  {revokeAllM.isPending ? 'Revocando…' : 'Revocar acceso completo al módulo'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
