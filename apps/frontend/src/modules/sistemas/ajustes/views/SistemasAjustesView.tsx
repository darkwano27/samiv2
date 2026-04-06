import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Cloud, Database, Mail, Plus, Settings2, Shield, Users } from 'lucide-react';
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
import { SoEmailSettingsTab } from '@/modules/salud-ocupacional/ajustes/components/SoEmailSettingsTab';
import type { SistemasAjustesTab } from '../sistemas-ajustes.types';
import { SistemasGlpiSettingsTab } from '../components/SistemasGlpiSettingsTab';
import { SistemasSharepointSettingsTab } from '../components/SistemasSharepointSettingsTab';
import { SistemasMemberDetailSheet } from '../components/SistemasMemberDetailSheet';
import { SistemasModuleProfileEditorDialog } from '../components/SistemasModuleProfileEditorDialog';
import {
  invalidateSisModuleSettingsRelatedQueries,
  readSisModuleSettingsMessage,
  sisApplyModuleProfile,
  sisDeleteModuleProfile,
  sisFetchModuleMembers,
  sisFetchModuleProfiles,
  sisFetchWorkerLookup,
  type SoModuleMember,
} from '../repository/sistemas-module-settings.api-repository';

const MEMBERS_PAGE_SIZE = 10;

const ajustesRouteApi = getRouteApi('/_authenticated/sistemas/ajustes');

const PROFILE_SLUGS = [
  'soporte',
  'aplicaciones',
  'infraestructura',
  'admin-sistemas',
] as const;

const PROFILE_LABEL: Record<(typeof PROFILE_SLUGS)[number], string> = {
  soporte: 'Soporte',
  aplicaciones: 'Aplicaciones',
  infraestructura: 'Infraestructura',
  'admin-sistemas': 'Admin Sistemas',
};

const PROFILE_CHIP: Record<string, string> = {
  soporte:
    'border-sky-500/35 bg-sky-500/10 text-sky-950 dark:text-sky-100',
  aplicaciones:
    'border-violet-500/35 bg-violet-500/10 text-violet-950 dark:text-violet-100',
  infraestructura:
    'border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100',
  'admin-sistemas':
    'border-rose-500/35 bg-rose-500/10 text-rose-950 dark:text-rose-100',
};

function inferPrimaryProfile(m: SoModuleMember): (typeof PROFILE_SLUGS)[number] | null {
  const s = new Set(m.assignments.map((a) => a.role_slug));
  if (s.has('module-admin')) return 'admin-sistemas';
  return null;
}

/** Slug para estilo de chip: prioriza perfil aplicado (incluye custom). */
function memberProfileChipSlug(m: SoModuleMember): string | null {
  const a = m.applied_profile_slug?.trim();
  if (a) return a;
  const pr = m.primary?.trim();
  if (pr) return pr;
  return inferPrimaryProfile(m);
}

/** Texto visible: prioriza etiqueta del perfil aplicado. */
function memberProfileChipLabel(m: SoModuleMember): string | null {
  const lbl = m.applied_profile_label?.trim();
  if (lbl) return lbl;
  const pr = m.primary?.trim();
  if (pr && pr in PROFILE_LABEL) {
    return PROFILE_LABEL[pr as keyof typeof PROFILE_LABEL];
  }
  const p = inferPrimaryProfile(m);
  return p ? PROFILE_LABEL[p] : null;
}

function initialsFromWorkerId(id: string): string {
  const t = id.trim();
  if (t.length >= 2) return t.slice(-2).toUpperCase();
  return t.toUpperCase() || '?';
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
  return initialsFromWorkerId(workerId);
}

export function SistemasAjustesView() {
  const qc = useQueryClient();
  const navigate = ajustesRouteApi.useNavigate();
  const { tab } = ajustesRouteApi.useSearch();
  const setTab = (next: SistemasAjustesTab) => {
    navigate({ search: (prev) => ({ ...prev, tab: next }), replace: true });
  };
  const [formError, setFormError] = useState<string | null>(null);
  const [sheetWorkerId, setSheetWorkerId] = useState<string | null>(null);
  const [newMemberSap, setNewMemberSap] = useState('');
  /** True cuando el SAP viene de elegir una fila del buscador (nombre o código). */
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
    const t = window.setTimeout(() => {
      setDebouncedMemberSearch(memberSearchInput.trim());
    }, 300);
    return () => window.clearTimeout(t);
  }, [memberSearchInput]);

  useEffect(() => {
    setMembersPage(1);
  }, [debouncedMemberSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedWorkerLookup(newMemberSap.trim());
    }, 300);
    return () => window.clearTimeout(t);
  }, [newMemberSap]);

  const workerLookupQ = useQuery({
    queryKey: ['sistemas', 'module-settings', 'worker-lookup', debouncedWorkerLookup],
    queryFn: () => sisFetchWorkerLookup(debouncedWorkerLookup),
    enabled: debouncedWorkerLookup.length >= 2,
    staleTime: 30_000,
  });

  const membersQ = useQuery({
    queryKey: [
      'sistemas',
      'module-settings',
      'members',
      debouncedMemberSearch,
      membersPage,
      MEMBERS_PAGE_SIZE,
    ],
    queryFn: () =>
      sisFetchModuleMembers({
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
    queryKey: ['sistemas', 'module-settings', 'module-profiles'],
    queryFn: sisFetchModuleProfiles,
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
    mutationFn: sisApplyModuleProfile,
    onSuccess: async () => {
      setFormError(null);
      setNewMemberSap('');
      setNewMemberPickedFromLookup(false);
      setNewMemberLookupOpen(false);
      await invalidateSisModuleSettingsRelatedQueries(qc);
    },
    onError: async (e) => {
      setFormError(
        (await readSisModuleSettingsMessage(e)) ?? 'No se pudo aplicar el perfil.',
      );
    },
  });

  const deleteProfileM = useMutation({
    mutationFn: (id: string) => sisDeleteModuleProfile(id),
    onSuccess: async () => {
      setFormError(null);
      await invalidateSisModuleSettingsRelatedQueries(qc);
    },
    onError: async (e) => {
      setFormError(
        (await readSisModuleSettingsMessage(e)) ?? 'No se pudo eliminar el perfil.',
      );
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
        'Elige una persona de la lista de sugerencias o ingresa solo el código numérico SAP.',
      );
      return;
    }
    if (!newMemberProfileSlug) {
      setFormError(
        'No hay perfiles cargados todavía. Espera un momento o crea uno en la pestaña Perfiles.',
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
    <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 p-3 sm:gap-6 sm:p-4 md:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
            Gestión roles — Sistemas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona quién puede usar las aplicaciones del módulo Sistemas, qué perfil tiene cada
            persona y cómo están definidos los perfiles.
          </p>
        </div>
      </header>

      {formError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <div
        className="flex min-h-[52px] w-full flex-wrap gap-1.5 rounded-xl border border-border/80 bg-muted/40 p-1.5 shadow-inner sm:flex-nowrap"
        role="tablist"
      >
        {(
          [
            { id: 'miembros' as const, label: 'Miembros', icon: Users },
            { id: 'perfiles' as const, label: 'Perfiles', icon: Shield },
            { id: 'correo' as const, label: 'Correo (PDF)', icon: Mail },
            { id: 'glpi' as const, label: 'GLPI', icon: Database },
            { id: 'sharepoint' as const, label: 'SharePoint', icon: Cloud },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={cn(
              'flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border px-2 py-2.5 text-sm font-medium transition-all sm:px-3',
              tab === id
                ? 'border-border bg-background text-foreground shadow-md ring-2 ring-primary/25'
                : 'border-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/60 hover:text-foreground',
            )}
            onClick={() => setTab(id)}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
            {id === 'miembros' && membersQ.data != null ? (
              <span className="text-xs text-muted-foreground">
                ({membersQ.data.total})
              </span>
            ) : null}
            {id === 'perfiles' && profilesQ.data ? (
              <span className="text-xs text-muted-foreground">
                ({profilesQ.data.profiles.length})
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'miembros' ? (
        <div className="flex flex-col gap-4">
          {profilesQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando resumen de perfiles…</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
              <CardTitle className="text-base">Agregar miembro</CardTitle>
              <CardDescription>
                Aplica a la persona una plantilla de permisos ya definida. Si ya tenía
                alguno de esos permisos, no se duplica.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-visible space-y-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
                <div className="relative min-w-0 flex-1 space-y-2">
                  <Label htmlFor="sis-new-sap">Código SAP o nombre</Label>
                  <Input
                    id="sis-new-sap"
                    autoComplete="off"
                    placeholder="SAP o al menos 2 caracteres para buscar"
                    value={newMemberSap}
                    onChange={(e) => {
                      setNewMemberPickedFromLookup(false);
                      setNewMemberSap(e.target.value);
                    }}
                    onFocus={() => setNewMemberLookupOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setNewMemberLookupOpen(false), 200);
                    }}
                    className="min-h-11"
                    aria-autocomplete="list"
                    aria-expanded={
                      newMemberLookupOpen &&
                      Boolean(workerLookupQ.data?.suggestions?.length)
                    }
                  />
                  {newMemberLookupOpen &&
                  debouncedWorkerLookup.length >= 2 &&
                  (workerLookupQ.isFetching ||
                    workerLookupQ.isError ||
                    (workerLookupQ.data?.suggestions?.length ?? 0) > 0) ? (
                    <ul
                      className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-lg"
                      role="listbox"
                    >
                      {workerLookupQ.isFetching ? (
                        <li className="px-3 py-2 text-muted-foreground">Buscando…</li>
                      ) : null}
                      {workerLookupQ.isError ? (
                        <li className="px-3 py-2 text-xs text-destructive">
                          No se pudo buscar. Reintenta en un momento.
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
                        <li className="px-3 py-2 text-muted-foreground">
                          Sin coincidencias. Prueba con otro texto o el código SAP completo.
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
                <div className="min-w-0 space-y-2 sm:w-[min(100%,280px)] sm:shrink-0">
                  <Label htmlFor="sis-new-profile">Perfil</Label>
                  <select
                    id="sis-new-profile"
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
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0">
                  <span
                    className="invisible hidden select-none text-sm font-medium leading-none sm:block"
                    aria-hidden
                  >
                    Código SAP o nombre
                  </span>
                  <Button
                    type="button"
                    className="min-h-11 w-full gap-2 bg-primary sm:w-auto"
                    disabled={applyProfileM.isPending}
                    onClick={() => void submitAddMember()}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {applyProfileM.isPending ? 'Aplicando…' : 'Agregar miembro'}
                  </Button>
                </div>
              </div>
              
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Miembros del módulo</CardTitle>
              <CardDescription>
                Gestionar abre el panel lateral: ver qué puede hacer la persona, sacar un permiso
                puntual, cambiar de plantilla o quitar todo el acceso al módulo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-0 sm:p-2">
              <div className="px-4 sm:px-2">
                <Label htmlFor="sis-members-search" className="sr-only">
                  Buscar por SAP o nombre
                </Label>
                <Input
                  id="sis-members-search"
                  type="search"
                  autoComplete="off"
                  placeholder="Buscar por SAP o nombre…"
                  value={memberSearchInput}
                  onChange={(e) => setMemberSearchInput(e.target.value)}
                  className="min-h-11 max-w-md"
                />
              </div>

              {membersQ.isLoading ? (
                <p className="px-4 py-4 text-sm text-muted-foreground sm:px-2">
                  Cargando…
                </p>
              ) : membersQ.isError ? (
                <div
                  role="alert"
                  className="mx-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:mx-2"
                >
                  No se pudo cargar la lista de miembros.{' '}
                  {membersQ.error instanceof Error ? membersQ.error.message : 'Error desconocido'}
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void membersQ.refetch()}
                    >
                      Reintentar
                    </Button>
                  </div>
                </div>
              ) : membersTotal === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground sm:px-2">
                  {debouncedMemberSearch
                    ? 'No hay coincidencias con la búsqueda.'
                    : 'Aún no hay asignaciones en este módulo.'}
                </p>
              ) : (
                <>
                  <div className="-mx-1 max-w-full overflow-x-auto overscroll-x-contain">
                    <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                          <th className="px-3 py-3 font-medium sm:px-4">Persona</th>
                          <th className="px-3 py-3 font-medium sm:px-4">Perfil</th>
                          <th className="px-3 py-3 font-medium sm:px-4">Aplicaciones</th>
                          <th className="px-3 py-3 font-medium sm:px-4"> </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(membersQ.data?.members ?? []).map((m) => {
                          const chipSlug = memberProfileChipSlug(m);
                          const chipLabel = memberProfileChipLabel(m);
                          const display =
                            m.display_name?.trim() || m.worker_id;
                          return (
                            <tr
                              key={m.worker_id}
                              className="border-b border-border/80 align-top"
                            >
                              <td className="px-3 py-3 sm:px-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                                    aria-hidden
                                  >
                                    {initialsFromDisplay(m.display_name, m.worker_id)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{display}</p>
                                    <p className="text-xs text-muted-foreground">
                                      SAP {m.worker_id}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 sm:px-4">
                                {chipLabel ? (
                                  <span
                                    className={cn(
                                      'inline-flex max-w-[min(100%,14rem)] rounded-full border px-2.5 py-0.5 text-xs font-medium',
                                      chipSlug
                                        ? (PROFILE_CHIP[chipSlug] ??
                                            'border-border bg-muted/40')
                                        : 'border-border bg-muted/40',
                                    )}
                                  >
                                    <span className="truncate">{chipLabel}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    —
                                  </span>
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
                  <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {rangeStart}–{rangeEnd} de {membersTotal} · Página{' '}
                      {membersListPage} / {totalMemberPages}
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
                        disabled={
                          membersListPage >= totalMemberPages || membersQ.isFetching
                        }
                        onClick={() =>
                          setMembersPage((p) =>
                            Math.min(totalMemberPages, p + 1),
                          )
                        }
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

      {tab === 'perfiles' ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
                <Settings2 className="h-4 w-4 text-primary" aria-hidden />
                Perfiles del módulo
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hay cuatro plantillas de sistema (Soporte, Aplicaciones, Infraestructura y Admin
                Sistemas). Podés crear perfiles propios con las acciones por aplicación. Los de
                sistema no se borran; los propios sí, cuando no quede nadie usando ese perfil.
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void profilesQ.refetch()}
                >
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
                    <dl className="space-y-2.5 text-sm">
                      <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2.5">
                        <dt className="text-muted-foreground">Miembros con este perfil</dt>
                        <dd className="shrink-0 tabular-nums font-medium">{p.member_count}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2.5">
                        <dt className="text-muted-foreground">Roles incluidos</dt>
                        <dd className="shrink-0 tabular-nums">{p.role_count}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2.5">
                        <dt className="text-muted-foreground">Aplicaciones</dt>
                        <dd className="shrink-0 tabular-nums">{p.unique_apps_count}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="text-muted-foreground">Detalle en matriz de permisos</dt>
                        <dd className="shrink-0 tabular-nums">{p.permission_matrix_cells}</dd>
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
                          disabled={
                            deleteProfileM.isPending || p.member_count > 0
                          }
                          title={
                            p.member_count > 0
                              ? `Hay ${p.member_count} persona(s) usando este perfil. Cambia o quita ese acceso antes de borrarlo.`
                              : 'Eliminar este perfil del módulo'
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

      {tab === 'correo' ? <SoEmailSettingsTab variant="sistemas" /> : null}

      {tab === 'glpi' ? <SistemasGlpiSettingsTab /> : null}

      {tab === 'sharepoint' ? <SistemasSharepointSettingsTab /> : null}

      <SistemasMemberDetailSheet
        open={sheetWorkerId !== null}
        workerId={sheetWorkerId}
        onClose={() => setSheetWorkerId(null)}
      />

      <SistemasModuleProfileEditorDialog
        open={profileEditorOpen}
        mode={profileEditorMode}
        profileId={profileEditorId}
        onClose={() => setProfileEditorOpen(false)}
      />
    </div>
  );
}
