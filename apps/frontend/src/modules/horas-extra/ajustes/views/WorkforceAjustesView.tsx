import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import {
  Building2,
  ChevronDown,
  Link2,
  Mail,
  Search,
  Settings,
  Shield,
  UserPlus,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { SoEmailSettingsTab } from '@/modules/salud-ocupacional/ajustes/components/SoEmailSettingsTab';
import { WorkforceBoletaServerTab } from '../components/WorkforceBoletaServerTab';
import { WorkforceRolesAjustesTab } from '../components/WorkforceRolesAjustesTab';
import type { WorkforceAjustesTab } from '../workforce-ajustes.types';
import {
  readWfModuleSettingsMessage,
  wfFetchOrgCatalog,
  wfFetchSubdivisionAssignments,
  wfFetchWorkerLookup,
  wfPatchSubdivisionAssignments,
  type WfAssigneeRow,
  type WfOrgGroup,
  type WfOrgSubdivision,
} from '../repository/workforce-module-settings.api-repository';

const ajustesRouteApi = getRouteApi('/_authenticated/horas-extra/ajustes');

function rowKey(div: string, sub: string): string {
  return `${div}|${sub}`;
}

function buildAssigneeIndex(items: WfAssigneeRow[]) {
  const m = new Map<string, { sup: WfAssigneeRow[]; app: WfAssigneeRow[] }>();
  for (const it of items) {
    const k = rowKey(it.division_code, it.subdivision_code);
    let e = m.get(k);
    if (!e) {
      e = { sup: [], app: [] };
      m.set(k, e);
    }
    if (it.role === 'supervisor') e.sup.push(it);
    else e.app.push(it);
  }
  return m;
}

function AssigneeCell({ rows }: { rows: WfAssigneeRow[] }) {
  if (rows.length === 0) {
    return <span className="text-sm italic text-muted-foreground">Sin asignación</span>;
  }
  return (
    <ul className="flex max-w-[14rem] flex-col gap-0.5 text-sm">
      {rows.map((r) => (
        <li key={r.worker_id} className="truncate" title={r.worker_name ?? r.worker_id}>
          <span className="font-medium text-foreground">{r.worker_name ?? r.worker_id}</span>
          <span className="ml-1 text-xs text-muted-foreground">SAP {r.worker_id}</span>
        </li>
      ))}
    </ul>
  );
}

type SheetCtx = {
  groupLabel: string;
  row: WfOrgSubdivision;
} | null;

function SubdivisionConfigSheet({
  open,
  ctx,
  initialSup: initialSupRows,
  initialApp: initialAppRows,
  onClose,
  onSaved,
}: {
  open: boolean;
  ctx: SheetCtx;
  initialSup: WfAssigneeRow[];
  initialApp: WfAssigneeRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [supIds, setSupIds] = useState<string[]>([]);
  const [appIds, setAppIds] = useState<string[]>([]);
  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [addFor, setAddFor] = useState<'supervisor' | 'approver' | null>(null);
  const [lookupQ, setLookupQ] = useState('');
  const [debouncedLookup, setDebouncedLookup] = useState('');
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !ctx) return;
    setSaveErr(null);
    setSupIds(initialSupRows.map((r) => r.worker_id));
    setAppIds(initialAppRows.map((r) => r.worker_id));
    const nm: Record<string, string> = {};
    for (const r of [...initialSupRows, ...initialAppRows]) {
      nm[r.worker_id] = r.worker_name ?? r.worker_id;
    }
    setNameById(nm);
    setAddFor(null);
    setLookupQ('');
    setDebouncedLookup('');
  }, [open, ctx, initialSupRows, initialAppRows]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedLookup(lookupQ.trim()), 300);
    return () => window.clearTimeout(t);
  }, [lookupQ]);

  const lookupQuery = useQuery({
    queryKey: ['workforce', 'worker-lookup', debouncedLookup],
    queryFn: () => wfFetchWorkerLookup(debouncedLookup),
    enabled: open && addFor != null && debouncedLookup.length >= 2,
    staleTime: 20_000,
  });

  const saveM = useMutation({
    mutationFn: wfPatchSubdivisionAssignments,
    onMutate: () => setSaveErr(null),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['workforce', 'subdivision-assignments'] });
      onSaved();
      onClose();
    },
    onError: async (e) => {
      setSaveErr((await readWfModuleSettingsMessage(e)) ?? 'No se pudo guardar.');
    },
  });

  const pushWorker = useCallback(
    (role: 'supervisor' | 'approver', id: string, name: string) => {
      const idt = id.trim();
      if (!idt) return;
      setNameById((prev) => ({ ...prev, [idt]: name.trim() || idt }));
      if (role === 'supervisor') {
        setSupIds((prev) => (prev.includes(idt) ? prev : [...prev, idt]));
      } else {
        setAppIds((prev) => (prev.includes(idt) ? prev : [...prev, idt]));
      }
      setAddFor(null);
      setLookupQ('');
    },
    [],
  );

  const removeWorker = (role: 'supervisor' | 'approver', id: string) => {
    if (role === 'supervisor') {
      setSupIds((prev) => prev.filter((x) => x !== id));
    } else {
      setAppIds((prev) => prev.filter((x) => x !== id));
    }
  };

  if (!open || !ctx) return null;

  const titleName = ctx.row.name?.trim() || ctx.row.subdivision_code;

  const sheet = (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[120] bg-black/40"
        aria-label="Cerrar panel"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-[121] flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wf-sheet-title"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {ctx.groupLabel}
            </p>
            <h2 id="wf-sheet-title" className="font-heading text-lg font-semibold leading-tight">
              {titleName}
            </h2>
            <p className="text-sm text-muted-foreground">Código {ctx.row.subdivision_code}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {saveErr ? (
            <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {saveErr}
            </p>
          ) : null}

          {(
            [
              { role: 'supervisor' as const, label: 'Supervisor', chip: 'border-violet-500/40 bg-violet-500/10 text-violet-950 dark:text-violet-100' },
              { role: 'approver' as const, label: 'Aprobador', chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100' },
            ] as const
          ).map(({ role, label, chip }) => {
            const ids = role === 'supervisor' ? supIds : appIds;
            return (
              <div
                key={role}
                className="mb-6 rounded-xl border border-border/80 bg-muted/20 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                      chip,
                    )}
                  >
                    {label}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-1"
                    onClick={() => setAddFor((prev) => (prev === role ? null : role))}
                  >
                    <UserPlus className="h-4 w-4" aria-hidden />
                    Agregar
                  </Button>
                </div>
                {ids.length === 0 ? (
                  <p className="mt-2 text-sm italic text-muted-foreground">Sin asignación</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {ids.map((id) => (
                      <li
                        key={id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          {nameById[id] ?? id}{' '}
                          <span className="text-muted-foreground">· SAP {id}</span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 px-2 text-destructive hover:text-destructive"
                          onClick={() => removeWorker(role, id)}
                        >
                          Quitar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                {addFor === role ? (
                  <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                    <Label htmlFor={`wf-lookup-${role}`}>Buscar por nombre o SAP</Label>
                    <Input
                      id={`wf-lookup-${role}`}
                      value={lookupQ}
                      onChange={(e) => setLookupQ(e.target.value)}
                      placeholder="Mínimo 2 caracteres"
                      autoComplete="off"
                    />
                    {debouncedLookup.length >= 2 ? (
                      <ul className="max-h-40 overflow-auto rounded-md border border-border text-sm">
                        {lookupQuery.isFetching ? (
                          <li className="px-3 py-2 text-muted-foreground">Buscando…</li>
                        ) : (lookupQuery.data?.suggestions.length ?? 0) === 0 ? (
                          <li className="px-3 py-2 text-muted-foreground">Sin resultados</li>
                        ) : (
                          lookupQuery.data!.suggestions.map((s) => (
                            <li key={s.sap_code}>
                              <button
                                type="button"
                                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted"
                                onClick={() => pushWorker(role, s.sap_code, s.name)}
                              >
                                <span className="font-medium">{s.name}</span>
                                <span className="text-xs text-muted-foreground">SAP {s.sap_code}</span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border p-4">
          <Button
            type="button"
            className="w-full"
            disabled={saveM.isPending}
            onClick={() => {
              void saveM.mutateAsync({
                division_code: ctx.row.division_code,
                subdivision_code: ctx.row.subdivision_code,
                supervisor_worker_ids: supIds,
                approver_worker_ids: appIds,
              });
            }}
          >
            {saveM.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </aside>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(sheet, document.body) : null;
}

export function WorkforceAjustesView() {
  const qc = useQueryClient();
  const navigate = ajustesRouteApi.useNavigate();
  const { tab } = ajustesRouteApi.useSearch();
  const setTab = (next: WorkforceAjustesTab) => {
    navigate({ search: (prev) => ({ ...prev, tab: next }), replace: true });
  };

  const [globalSearch, setGlobalSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sheetCtx, setSheetCtx] = useState<SheetCtx>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(globalSearch.trim().toLowerCase()), 200);
    return () => window.clearTimeout(t);
  }, [globalSearch]);

  const catalogQ = useQuery({
    queryKey: ['workforce', 'org-catalog'],
    queryFn: wfFetchOrgCatalog,
    staleTime: 120_000,
  });

  const assignQ = useQuery({
    queryKey: ['workforce', 'subdivision-assignments'],
    queryFn: wfFetchSubdivisionAssignments,
    staleTime: 30_000,
  });

  const assignIndex = useMemo(
    () => buildAssigneeIndex(assignQ.data?.items ?? []),
    [assignQ.data?.items],
  );

  const filteredGroups = useMemo(() => {
    const q = debouncedSearch;
    const groups = catalogQ.data?.groups ?? [];
    if (!q) return groups;

    return groups
      .map((g) => {
        const groupMatch =
          g.label.toLowerCase().includes(q) ||
          g.division_codes.some((c) => c.toLowerCase().includes(q));
        const subs = g.subdivisions.filter((s) => {
          const name = (s.name ?? '').toLowerCase();
          return (
            groupMatch ||
            name.includes(q) ||
            s.subdivision_code.toLowerCase().includes(q) ||
            s.division_code.toLowerCase().includes(q)
          );
        });
        if (groupMatch) {
          return { ...g, subdivisions: g.subdivisions };
        }
        return { ...g, subdivisions: subs };
      })
      .filter((g) => g.subdivisions.length > 0 || g.label.toLowerCase().includes(q));
  }, [catalogQ.data?.groups, debouncedSearch]);

  const openSheet = (groupLabel: string, row: WfOrgSubdivision) => {
    setSheetCtx({ groupLabel, row });
  };

  const sheetKey = sheetCtx ? rowKey(sheetCtx.row.division_code, sheetCtx.row.subdivision_code) : '';
  const sheetBucket = sheetKey ? assignIndex.get(sheetKey) : undefined;

  return (
    <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 p-3 sm:gap-6 sm:p-4 md:p-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
            Ajustes — WorkForce
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Administrá la organización ARIS (divisiones y subdivisión), roles del módulo, correo SMTP y
          el servidor de destino para los CSV de boletas.
        </p>
      </header>

      <div
        className="flex min-h-[52px] w-full flex-wrap gap-1.5 rounded-xl border border-border/80 bg-muted/40 p-1.5 shadow-inner sm:flex-nowrap"
        role="tablist"
      >
        {(
          [
            { id: 'organizacion' as const, label: 'Organización', icon: Building2 },
            { id: 'roles' as const, label: 'Roles', icon: Shield },
            { id: 'correo' as const, label: 'Correo', icon: Mail },
            { id: 'conexion' as const, label: 'Directorio / servidor', icon: Link2 },
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
          </button>
        ))}
      </div>

      {tab === 'organizacion' ? (
        <div className="flex flex-col gap-4">
          <div className="relative max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              className="pl-9"
              placeholder="Buscar división, subdivisión o código…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              aria-label="Búsqueda global"
            />
          </div>

          {catalogQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando catálogo…</p>
          ) : catalogQ.isError ? (
            <p className="text-sm text-destructive">
              No se pudo cargar el catálogo.{' '}
              {catalogQ.error instanceof Error ? catalogQ.error.message : ''}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredGroups.map((g) => (
                <DivisionAccordion
                  key={g.slug}
                  group={g}
                  assignIndex={assignIndex}
                  onConfig={openSheet}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'roles' ? <WorkforceRolesAjustesTab /> : null}
      {tab === 'correo' ? <SoEmailSettingsTab variant="workforce" /> : null}
      {tab === 'conexion' ? <WorkforceBoletaServerTab /> : null}

      <SubdivisionConfigSheet
        open={sheetCtx != null}
        ctx={sheetCtx}
        initialSup={sheetBucket?.sup ?? []}
        initialApp={sheetBucket?.app ?? []}
        onClose={() => setSheetCtx(null)}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ['workforce', 'subdivision-assignments'] });
        }}
      />
    </div>
  );
}

function DivisionAccordion({
  group,
  assignIndex,
  onConfig,
}: {
  group: WfOrgGroup;
  assignIndex: Map<string, { sup: WfAssigneeRow[]; app: WfAssigneeRow[] }>;
  onConfig: (groupLabel: string, row: WfOrgSubdivision) => void;
}) {
  const subCount = group.subdivisions.length;
  const codes = group.division_codes.join(', ');

  return (
    <details className="group rounded-xl border border-border/80 bg-card shadow-sm open:shadow-md">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">
            {group.label}
          </p>
          <p className="text-xs text-muted-foreground">
            {codes} · {subCount} {subCount === 1 ? 'subdivisión' : 'subdivisiones'}
          </p>
        </div>
      </summary>
      <div className="border-t border-border/60 px-2 pb-3 pt-1 sm:px-3">
        {subCount === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            No hay subdivisiones en el directorio SAP para esta división (o la réplica no está
            conectada).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Subdivisión</th>
                  <th className="px-3 py-2 font-medium">Supervisor</th>
                  <th className="px-3 py-2 font-medium">Aprobador</th>
                  <th className="px-3 py-2 font-medium w-28" />
                </tr>
              </thead>
              <tbody>
                {group.subdivisions.map((row) => {
                  const k = rowKey(row.division_code, row.subdivision_code);
                  const b = assignIndex.get(k);
                  return (
                    <tr key={k} className="border-b border-border/70 last:border-0">
                      <td className="px-3 py-2 align-top">
                        <p className="font-medium text-foreground">
                          {row.name?.trim() || row.subdivision_code}
                        </p>
                        <p className="text-xs text-muted-foreground">{row.subdivision_code}</p>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <AssigneeCell rows={b?.sup ?? []} />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <AssigneeCell rows={b?.app ?? []} />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => onConfig(group.label, row)}
                        >
                          <Settings className="h-3.5 w-3.5" aria-hidden />
                          Config
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}
