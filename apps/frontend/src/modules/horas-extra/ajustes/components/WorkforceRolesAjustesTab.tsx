import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Settings2, Shield, UserCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { SoModuleMember } from '../repository/workforce-module-settings.api-repository';
import {
  invalidateWfModuleSettingsRelatedQueries,
  readWfModuleSettingsMessage,
  wfApplyModuleProfile,
  wfDeleteModuleProfile,
  wfFetchModuleMembers,
  wfFetchModuleProfiles,
  wfFetchWorkerLookup,
} from '../repository/workforce-module-settings.api-repository';
import { WorkforceMemberDetailSheet } from './WorkforceMemberDetailSheet';
import { WorkforceModuleProfileEditorDialog } from './WorkforceModuleProfileEditorDialog';

const MEMBERS_PAGE_SIZE = 10;

const PROFILE_LABEL: Record<string, string> = {
  'supervisor-he': 'Supervisor',
  'aprobador-he': 'Aprobador',
  'admin-wf': 'Admin WorkForce',
};

const PROFILE_CHIP: Record<string, string> = {
  'supervisor-he':
    'border-violet-500/35 bg-violet-500/10 text-violet-950 dark:text-violet-100',
  'aprobador-he':
    'border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100',
  'admin-wf': 'border-rose-500/35 bg-rose-500/10 text-rose-950 dark:text-rose-100',
};

function inferPrimaryProfile(m: SoModuleMember): string | null {
  const s = new Set(m.assignments.map((a) => a.role_slug));
  if (s.has('module-admin')) return 'admin-wf';
  if (s.has('aprobador')) return 'aprobador-he';
  if (s.has('supervisor')) return 'supervisor-he';
  return null;
}

function memberProfileChipSlug(m: SoModuleMember): string | null {
  const a = m.applied_profile_slug?.trim();
  if (a) return a;
  const pr = m.primary?.trim();
  if (pr) return pr;
  return inferPrimaryProfile(m);
}

function memberProfileChipLabel(m: SoModuleMember): string | null {
  const lbl = m.applied_profile_label?.trim();
  if (lbl) return lbl;
  const pr = m.primary?.trim();
  if (pr && pr in PROFILE_LABEL) {
    return PROFILE_LABEL[pr];
  }
  const p = inferPrimaryProfile(m);
  return p ? PROFILE_LABEL[p] ?? p : null;
}

function initialsFromDisplay(name: string | null | undefined, workerId: string): string {
  const n = (name ?? '').trim();
  if (n.length >= 2) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const t = workerId.trim();
  return t.length >= 2 ? t.slice(-2).toUpperCase() : '?';
}

type RolesSubTab = 'personas' | 'perfiles';

export function WorkforceRolesAjustesTab() {
  const qc = useQueryClient();
  const [rolesSubTab, setRolesSubTab] = useState<RolesSubTab>('personas');
  const [formError, setFormError] = useState<string | null>(null);
  const [sheetWorkerId, setSheetWorkerId] = useState<string | null>(null);
  const [newMemberSap, setNewMemberSap] = useState('');
  const [newMemberPickedFromLookup, setNewMemberPickedFromLookup] = useState(false);
  const [newMemberLookupOpen, setNewMemberLookupOpen] = useState(false);
  const [debouncedWorkerLookup, setDebouncedWorkerLookup] = useState('');
  const [newMemberProfileSlug, setNewMemberProfileSlug] = useState('');
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileEditorMode, setProfileEditorMode] = useState<'create' | 'edit'>('create');
  const [profileEditorId, setProfileEditorId] = useState<string | null>(null);
  const [memberSearchInput, setMemberSearchInput] = useState('');
  const [debouncedMemberSearch, setDebouncedMemberSearch] = useState('');
  const [membersPage, setMembersPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedMemberSearch(memberSearchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [memberSearchInput]);

  useEffect(() => {
    setMembersPage(1);
  }, [debouncedMemberSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedWorkerLookup(newMemberSap.trim()), 300);
    return () => window.clearTimeout(t);
  }, [newMemberSap]);

  const workerLookupQ = useQuery({
    queryKey: ['workforce', 'module-settings', 'worker-lookup', debouncedWorkerLookup],
    queryFn: () => wfFetchWorkerLookup(debouncedWorkerLookup),
    enabled: debouncedWorkerLookup.length >= 2,
    staleTime: 30_000,
  });

  const membersQ = useQuery({
    queryKey: [
      'workforce',
      'module-settings',
      'members',
      debouncedMemberSearch,
      membersPage,
      MEMBERS_PAGE_SIZE,
    ],
    queryFn: () =>
      wfFetchModuleMembers({
        search: debouncedMemberSearch || undefined,
        page: membersPage,
        limit: MEMBERS_PAGE_SIZE,
      }),
  });

  useEffect(() => {
    const p = membersQ.data?.page;
    if (p == null) return;
    setMembersPage((prev) => (prev !== p ? p : prev));
  }, [membersQ.data?.page]);

  const profilesQ = useQuery({
    queryKey: ['workforce', 'module-settings', 'module-profiles'],
    queryFn: wfFetchModuleProfiles,
  });

  useEffect(() => {
    const list = profilesQ.data?.profiles;
    if (!list?.length) return;
    setNewMemberProfileSlug((prev) => {
      if (prev && list.some((p) => p.slug === prev)) return prev;
      return list[0]!.slug;
    });
  }, [profilesQ.data?.profiles]);

  const profileStats = membersQ.data?.profile_counts ?? {};
  const membersTotal = membersQ.data?.total ?? 0;
  const membersLimit = membersQ.data?.limit ?? MEMBERS_PAGE_SIZE;
  const membersListPage = membersQ.data?.page ?? membersPage;
  const totalMemberPages = Math.max(1, Math.ceil(membersTotal / membersLimit) || 1);
  const rangeStart = membersTotal === 0 ? 0 : (membersListPage - 1) * membersLimit + 1;
  const rangeEnd = Math.min(membersListPage * membersLimit, membersTotal);

  const applyProfileM = useMutation({
    mutationFn: wfApplyModuleProfile,
    onSuccess: async () => {
      setFormError(null);
      setNewMemberSap('');
      setNewMemberPickedFromLookup(false);
      setNewMemberLookupOpen(false);
      await invalidateWfModuleSettingsRelatedQueries(qc);
    },
    onError: async (e) => {
      setFormError((await readWfModuleSettingsMessage(e)) ?? 'No se pudo aplicar el perfil.');
    },
  });

  const deleteProfileM = useMutation({
    mutationFn: (id: string) => wfDeleteModuleProfile(id),
    onSuccess: async () => {
      setFormError(null);
      await invalidateWfModuleSettingsRelatedQueries(qc);
    },
    onError: async (e) => {
      setFormError((await readWfModuleSettingsMessage(e)) ?? 'No se pudo eliminar el perfil.');
    },
  });

  function submitAddMember() {
    setFormError(null);
    const w = newMemberSap.trim();
    if (!w) {
      setFormError('Ingresa el código SAP o busca por nombre.');
      return;
    }
    const looksLikeSapOnly = /^\d+$/.test(w);
    if (!looksLikeSapOnly && !newMemberPickedFromLookup) {
      setFormError(
        'Elegí una persona de la lista de sugerencias o ingresá solo el código numérico SAP.',
      );
      return;
    }
    if (!newMemberProfileSlug) {
      setFormError(
        'No hay perfiles cargados todavía. Esperá un momento o creá uno en la sub-pestaña Perfiles.',
      );
      return;
    }
    applyProfileM.mutate({ worker_id: w, profile_slug: newMemberProfileSlug });
  }

  function confirmDeleteProfile(id: string, label: string) {
    if (
      !window.confirm(
        `¿Eliminar el perfil «${label}»? Dejará de estar disponible para asignar a otras personas.`,
      )
    ) {
      return;
    }
    deleteProfileM.mutate(id);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/20 bg-muted/20 shadow-none">
        <CardHeader className="space-y-1 pb-2 pt-3">
          <CardTitle className="text-sm font-medium">Dos ideas distintas (no se mezclan)</CardTitle>
          <CardDescription className="text-xs leading-relaxed sm:text-sm">
            <strong>Organización:</strong> en cada subdivisión definís quién es <strong>supervisor</strong> y quién{' '}
            <strong>aprobador</strong> de boletas para esa área (SAP por subdivisión).{' '}
            <strong>Roles (esta pestaña):</strong> perfiles del módulo — Admin WorkForce, Supervisor y Aprobador a
            nivel <em>aplicación</em> (quién puede entrar a Bandeja, Registro, Ajustes, etc.). Los perfiles aparecen
            en <strong>Perfiles (roles)</strong> abajo; si la lista está vacía, ejecutá en el servidor{' '}
            <code className="rounded bg-muted px-1 font-mono text-[11px]">pnpm seed:rbac</code> (backend).
          </CardDescription>
        </CardHeader>
      </Card>

      <div
        className="flex min-h-[48px] w-full max-w-xl flex-wrap gap-1 rounded-lg border border-border/80 bg-muted/30 p-1"
        role="tablist"
      >
        {(
          [
            { id: 'personas' as const, label: 'Personas y accesos', icon: UserCircle },
            { id: 'perfiles' as const, label: 'Perfiles (roles)', icon: Shield },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={rolesSubTab === id}
            className={cn(
              'flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border px-2 py-2 text-sm font-medium',
              rolesSubTab === id
                ? 'border-border bg-background shadow-sm ring-2 ring-primary/20'
                : 'border-transparent text-muted-foreground hover:bg-muted/50',
            )}
            onClick={() => setRolesSubTab(id)}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {formError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      {rolesSubTab === 'personas' ? (
        <div className="flex flex-col gap-4">
          {profilesQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando resumen de perfiles…</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(profilesQ.data?.profiles ?? []).map((p) => (
                <Card key={p.id} className="border-border/80 shadow-none">
                  <CardContent className="p-2.5 sm:p-3">
                    <p className="line-clamp-2 text-[11px] font-medium leading-tight text-muted-foreground sm:text-xs">
                      {p.label}
                      {p.is_seed ? (
                        <span className="ml-1 text-[9px] uppercase opacity-70">(sistema)</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums leading-none sm:text-xl">
                      {profileStats[p.slug] ?? 0}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card className="overflow-visible">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Agregar persona</CardTitle>
              <CardDescription>
                Aplicá una plantilla (Supervisor, Aprobador o Admin WorkForce). Los permisos no se
                duplican si ya existían.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 overflow-visible">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
                <div className="relative min-w-0 flex-1 space-y-2">
                  <Label htmlFor="wf-new-sap">Código SAP o nombre</Label>
                  <Input
                    id="wf-new-sap"
                    autoComplete="off"
                    placeholder="SAP o al menos 2 caracteres para buscar"
                    value={newMemberSap}
                    onChange={(e) => {
                      setNewMemberPickedFromLookup(false);
                      setNewMemberSap(e.target.value);
                    }}
                    onFocus={() => setNewMemberLookupOpen(true)}
                    onBlur={() => window.setTimeout(() => setNewMemberLookupOpen(false), 200)}
                    className="min-h-11"
                  />
                  {newMemberLookupOpen &&
                  debouncedWorkerLookup.length >= 2 &&
                  (workerLookupQ.isFetching ||
                    workerLookupQ.isError ||
                    (workerLookupQ.data?.suggestions.length ?? 0) > 0) ? (
                    <ul
                      className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-lg"
                      role="listbox"
                    >
                      {workerLookupQ.isFetching ? (
                        <li className="px-3 py-2 text-muted-foreground">Buscando…</li>
                      ) : null}
                      {workerLookupQ.isError ? (
                        <li className="px-3 py-2 text-xs text-destructive">
                          No se pudo buscar. Reintentá en un momento.
                        </li>
                      ) : null}
                      {!workerLookupQ.isFetching &&
                        !workerLookupQ.isError &&
                        (workerLookupQ.data?.suggestions ?? []).map((s) => (
                          <li key={s.sap_code} role="option">
                            <button
                              type="button"
                              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setNewMemberSap(s.sap_code);
                                setNewMemberPickedFromLookup(true);
                                setNewMemberLookupOpen(false);
                              }}
                            >
                              <span className="font-medium">{s.name}</span>
                              <span className="text-xs text-muted-foreground">SAP {s.sap_code}</span>
                            </button>
                          </li>
                        ))}
                      {!workerLookupQ.isFetching &&
                      !workerLookupQ.isError &&
                      (workerLookupQ.data?.suggestions?.length ?? 0) === 0 ? (
                        <li className="px-3 py-2 text-muted-foreground">Sin coincidencias.</li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
                <div className="min-w-0 space-y-2 sm:w-[min(100%,280px)] sm:shrink-0">
                  <Label htmlFor="wf-new-profile">Perfil</Label>
                  <select
                    id="wf-new-profile"
                    className="flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={newMemberProfileSlug}
                    onChange={(e) => setNewMemberProfileSlug(e.target.value)}
                    disabled={!profilesQ.data?.profiles?.length}
                  >
                    {(profilesQ.data?.profiles ?? []).map((p) => (
                      <option key={p.id} value={p.slug}>
                        {p.label}
                        {p.is_seed ? ' — predeterminado' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  className="min-h-11 w-full gap-2 bg-primary sm:w-auto"
                  disabled={applyProfileM.isPending}
                  onClick={() => void submitAddMember()}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {applyProfileM.isPending ? 'Aplicando…' : 'Agregar'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personas con acceso al módulo</CardTitle>
              <CardDescription>
                Gestionar abre el panel: permisos puntuales, cambiar plantilla o revocar todo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-0 sm:p-2">
              <div className="px-4 sm:px-2">
                <Label htmlFor="wf-members-search" className="sr-only">
                  Buscar
                </Label>
                <Input
                  id="wf-members-search"
                  type="search"
                  autoComplete="off"
                  placeholder="Buscar por SAP o nombre…"
                  value={memberSearchInput}
                  onChange={(e) => setMemberSearchInput(e.target.value)}
                  className="min-h-11 max-w-md"
                />
              </div>
              {membersQ.isLoading ? (
                <p className="px-4 py-4 text-sm text-muted-foreground sm:px-2">Cargando…</p>
              ) : membersQ.isError ? (
                <div
                  role="alert"
                  className="mx-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:mx-2"
                >
                  No se pudo cargar la lista.
                  <div className="mt-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => void membersQ.refetch()}>
                      Reintentar
                    </Button>
                  </div>
                </div>
              ) : membersTotal === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground sm:px-2">
                  {debouncedMemberSearch
                    ? 'No hay coincidencias.'
                    : 'Aún no hay asignaciones en WorkForce.'}
                </p>
              ) : (
                <>
                  <div className="-mx-1 max-w-full overflow-x-auto">
                    <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                          <th className="px-3 py-3 font-medium sm:px-4">Persona</th>
                          <th className="px-3 py-3 font-medium sm:px-4">Perfil</th>
                          <th className="px-3 py-3 font-medium sm:px-4">Apps</th>
                          <th className="px-3 py-3 sm:px-4"> </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(membersQ.data?.members ?? []).map((m) => {
                          const chipSlug = memberProfileChipSlug(m);
                          const chipLabel = memberProfileChipLabel(m);
                          const display = m.display_name?.trim() || m.worker_id;
                          return (
                            <tr key={m.worker_id} className="border-b border-border/80 align-top">
                              <td className="px-3 py-3 sm:px-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                                    {initialsFromDisplay(m.display_name, m.worker_id)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{display}</p>
                                    <p className="text-xs text-muted-foreground">SAP {m.worker_id}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 sm:px-4">
                                {chipLabel ? (
                                  <span
                                    className={cn(
                                      'inline-flex max-w-[min(100%,14rem)] rounded-full border px-2.5 py-0.5 text-xs font-medium',
                                      chipSlug
                                        ? (PROFILE_CHIP[chipSlug] ?? 'border-border bg-muted/40')
                                        : 'border-border bg-muted/40',
                                    )}
                                  >
                                    <span className="truncate">{chipLabel}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3 tabular-nums sm:px-4">
                                {m.app_count}{' '}
                                <span className="text-muted-foreground">aplicaciones</span>
                              </td>
                              <td className="px-3 py-3 sm:px-4">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                                  onClick={() => setSheetWorkerId(m.worker_id)}
                                >
                                  Gestionar
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      {rangeStart}–{rangeEnd} de {membersTotal} · Página {membersListPage} /{' '}
                      {totalMemberPages}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={membersListPage <= 1 || membersQ.isFetching}
                        onClick={() => setMembersPage((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={membersListPage >= totalMemberPages || membersQ.isFetching}
                        onClick={() => setMembersPage((p) => Math.min(totalMemberPages, p + 1))}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {rolesSubTab === 'perfiles' ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
                <Settings2 className="h-4 w-4 text-primary" aria-hidden />
                Perfiles del módulo
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Plantillas de sistema (Supervisor, Aprobador, Admin WorkForce) y perfiles propios.
                Los de sistema no se eliminan; los propios sí, si nadie los usa.
              </p>
            </div>
            <Button
              type="button"
              className="min-h-11 w-full gap-2 sm:w-auto"
              onClick={() => {
                setProfileEditorMode('create');
                setProfileEditorId(null);
                setProfileEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Crear perfil
            </Button>
          </div>

          {profilesQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando perfiles…</p>
          ) : profilesQ.isError ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              No se pudo cargar la lista de perfiles.
              <div className="mt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => void profilesQ.refetch()}>
                  Reintentar
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {(profilesQ.data?.profiles ?? []).map((p) => (
                <Card key={p.id} className="border-border/80 shadow-none">
                  <CardHeader className="space-y-1.5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base leading-snug">{p.label}</CardTitle>
                      {p.is_seed ? (
                        <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                          Sistema
                        </span>
                      ) : null}
                    </div>
                    {p.description ? (
                      <CardDescription className="line-clamp-3 text-sm leading-relaxed">
                        {p.description}
                      </CardDescription>
                    ) : (
                      <CardDescription className="text-sm text-muted-foreground">
                        Sin descripción breve
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <dl className="space-y-2.5">
                      <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2.5">
                        <dt className="text-muted-foreground">Miembros con este perfil</dt>
                        <dd className="shrink-0 tabular-nums font-medium">{p.member_count}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2.5">
                        <dt className="text-muted-foreground">Roles incluidos</dt>
                        <dd className="shrink-0 tabular-nums">{p.role_count}</dd>
                      </div>
                    </dl>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-9 flex-1"
                        onClick={() => {
                          setProfileEditorMode('edit');
                          setProfileEditorId(p.id);
                          setProfileEditorOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      {!p.is_seed ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9 flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-60"
                          disabled={deleteProfileM.isPending || p.member_count > 0}
                          title={
                            p.member_count > 0
                              ? `Hay ${p.member_count} persona(s) con este perfil.`
                              : 'Eliminar perfil'
                          }
                          onClick={() => confirmDeleteProfile(p.id, p.label)}
                        >
                          Eliminar
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <WorkforceMemberDetailSheet
        open={sheetWorkerId !== null}
        workerId={sheetWorkerId}
        onClose={() => setSheetWorkerId(null)}
      />

      <WorkforceModuleProfileEditorDialog
        open={profileEditorOpen}
        mode={profileEditorMode}
        profileId={profileEditorId}
        onClose={() => setProfileEditorOpen(false)}
      />
    </div>
  );
}
