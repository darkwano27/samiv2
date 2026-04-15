import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Pencil, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { readApiMessage } from '@/modules/salud-ocupacional/registro-consulta/repository/so-consultations.api-repository';
import {
  SO_MEDICINE_ADMIN_ROUTES,
  SO_MEDICINE_INVENTORY_UNITS,
  SO_MEDICINE_PRESENTATIONS,
} from '@/modules/salud-ocupacional/registro-consulta/types/so-medicine-form.constants';
import {
  soInventarioCreateDiagnosis,
  soInventarioCreateMedicine,
  soInventarioFetchDiagnoses,
  soInventarioFetchMedicines,
  soInventarioPatchDiagnosis,
  soInventarioPatchMedicine,
  type SoInventarioDiagnosis,
  type SoInventarioMedicine,
} from '../api/so-inventario.api';

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

function fmtVencimiento(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return '—';
  try {
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(
      new Date(y, m - 1, day),
    );
  } catch {
    return d;
  }
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        active ? 'bg-emerald-100 text-emerald-900' : 'bg-muted text-muted-foreground',
      )}
    >
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}

const dxColHelper = createColumnHelper<SoInventarioDiagnosis>();

function DiagnosesPanel() {
  const qc = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [dxSearch, setDxSearch] = useState('');
  const [dxEstado, setDxEstado] = useState<'all' | 'active' | 'inactive'>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<SoInventarioDiagnosis | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);

  useEffect(() => {
    if (edit) {
      setName(edit.name);
      setCode(edit.code ?? '');
    }
  }, [edit]);

  const q = useQuery({
    queryKey: ['so', 'inventario', 'diagnoses'],
    queryFn: () => soInventarioFetchDiagnoses(),
  });

  const createM = useMutation({
    mutationFn: soInventarioCreateDiagnosis,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['so', 'inventario', 'diagnoses'] });
      setAddOpen(false);
      setName('');
      setCode('');
      setFormErr(null);
      setListErr(null);
    },
    onError: async (e) => {
      const msg = (await readApiMessage(e)) ?? 'No se pudo crear.';
      setFormErr(msg);
      setListErr(msg);
    },
  });

  const patchM = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof soInventarioPatchDiagnosis>[1];
    }) => soInventarioPatchDiagnosis(id, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['so', 'inventario', 'diagnoses'] });
      setEdit(null);
      setFormErr(null);
      setListErr(null);
    },
    onError: async (e) => {
      const msg = (await readApiMessage(e)) ?? 'No se pudo guardar.';
      setFormErr(msg);
      setListErr(msg);
    },
  });

  const filteredDiagnoses = useMemo(() => {
    const rows = q.data ?? [];
    let out = rows;
    if (dxEstado !== 'all') {
      const want = dxEstado === 'active';
      out = out.filter((r) => r.isActive === want);
    }
    const s = dxSearch.trim().toLowerCase();
    if (s) {
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          (r.code?.toLowerCase().includes(s) ?? false),
      );
    }
    return out;
  }, [q.data, dxSearch, dxEstado]);

  const columns = useMemo(
    () => [
      dxColHelper.accessor('name', {
        header: 'Nombre',
        cell: (c) => <span className="font-medium">{c.getValue()}</span>,
      }),
      dxColHelper.accessor('code', {
        header: 'CIE-10',
        cell: (c) => c.getValue() ?? '—',
      }),
      dxColHelper.accessor('isActive', {
        header: 'Estado',
        cell: (c) => <ActiveBadge active={c.getValue()} />,
      }),
      dxColHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => {
                setEdit(row.original);
                setFormErr(null);
              }}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Editar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                const next = !row.original.isActive;
                const msg = next
                  ? '¿Reactivar este diagnóstico en el catálogo?'
                  : '¿Desactivar este diagnóstico? No podrá usarse en nuevas consultas.';
                if (!window.confirm(msg)) return;
                patchM.mutate({ id: row.original.id, body: { isActive: next } });
              }}
            >
              {row.original.isActive ? 'Desactivar' : 'Reactivar'}
            </Button>
          </div>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: filteredDiagnoses,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rawCount = q.data?.length ?? 0;
  const emptyHint =
    rawCount === 0
      ? 'Sin registros.'
      : 'Ningún resultado con estos filtros. Probá otro texto o cambiá el estado.';

  function submitAdd() {
    setFormErr(null);
    const n = name.trim();
    if (!n) {
      setFormErr('El nombre es obligatorio.');
      return;
    }
    createM.mutate({ name: n, code: code.trim() || undefined });
  }

  function submitEdit() {
    if (!edit) return;
    setFormErr(null);
    const n = name.trim();
    if (!n) {
      setFormErr('El nombre es obligatorio.');
      return;
    }
    patchM.mutate({
      id: edit.id,
      body: { name: n, code: code.trim() || null },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Catálogo usado al registrar consultas. Desactivar oculta el ítem en nuevos registros.
        </p>
        <Button
          type="button"
          className="gap-2"
          onClick={() => {
            setFormErr(null);
            setName('');
            setCode('');
            setAddOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo diagnóstico
        </Button>
      </div>

      {q.isError ? (
        <p className="text-sm text-destructive">No se pudo cargar el catálogo.</p>
      ) : null}
      {listErr ? (
        <p className="text-sm text-destructive" role="alert">
          {listErr}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative min-w-0 flex-1 space-y-2">
          <Label htmlFor="inv-dx-search">Buscar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="inv-dx-search"
              className="pl-9"
              value={dxSearch}
              onChange={(e) => setDxSearch(e.target.value)}
              placeholder="Nombre o código CIE-10…"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="w-full space-y-2 sm:w-44">
          <Label htmlFor="inv-dx-estado">Estado</Label>
          <select
            id="inv-dx-estado"
            className={selectClass}
            value={dxEstado}
            onChange={(e) => setDxEstado(e.target.value as typeof dxEstado)}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b bg-muted/40">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-3 py-2 font-medium">
                    {h.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn(
                          'inline-flex items-center gap-1',
                          h.column.getCanSort() ? 'cursor-pointer select-none hover:underline' : '',
                        )}
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === 'asc'
                          ? ' ▲'
                          : h.column.getIsSorted() === 'desc'
                            ? ' ▼'
                            : null}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {q.isLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  {emptyHint}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {addOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onClick={() => !createM.isPending && setAddOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading text-lg font-semibold">Nuevo diagnóstico</h2>
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="inv-dx-name">Nombre</Label>
                <Input
                  id="inv-dx-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={createM.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-dx-code">CIE-10 (opcional)</Label>
                <Input
                  id="inv-dx-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={createM.isPending}
                />
              </div>
              {formErr ? (
                <p className="text-sm text-destructive" role="alert">
                  {formErr}
                </p>
              ) : null}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={createM.isPending}
                onClick={() => setAddOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" disabled={createM.isPending} onClick={() => void submitAdd()}>
                {createM.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {edit ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onClick={() => !patchM.isPending && setEdit(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading text-lg font-semibold">Editar diagnóstico</h2>
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="inv-dx-edit-name">Nombre</Label>
                <Input
                  id="inv-dx-edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={patchM.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-dx-edit-code">CIE-10</Label>
                <Input
                  id="inv-dx-edit-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={patchM.isPending}
                />
              </div>
              {formErr ? (
                <p className="text-sm text-destructive" role="alert">
                  {formErr}
                </p>
              ) : null}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={patchM.isPending}
                onClick={() => setEdit(null)}
              >
                Cancelar
              </Button>
              <Button type="button" disabled={patchM.isPending} onClick={() => void submitEdit()}>
                {patchM.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const medColHelper = createColumnHelper<SoInventarioMedicine>();

function MedicinesPanel() {
  const qc = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [medSearch, setMedSearch] = useState('');
  const [medEstado, setMedEstado] = useState<'all' | 'active' | 'inactive'>('all');
  const [presentationFilter, setPresentationFilter] = useState<string>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<SoInventarioMedicine | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['so', 'inventario', 'medicines'],
    queryFn: () => soInventarioFetchMedicines(),
  });

  const createM = useMutation({
    mutationFn: soInventarioCreateMedicine,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['so', 'inventario', 'medicines'] });
      setAddOpen(false);
      setFormErr(null);
      setListErr(null);
    },
    onError: async (e) => {
      const msg = (await readApiMessage(e)) ?? 'No se pudo crear.';
      setFormErr(msg);
      setListErr(msg);
    },
  });

  const patchM = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof soInventarioPatchMedicine>[1];
    }) => soInventarioPatchMedicine(id, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['so', 'inventario', 'medicines'] });
      setEdit(null);
      setFormErr(null);
      setListErr(null);
    },
    onError: async (e) => {
      const msg = (await readApiMessage(e)) ?? 'No se pudo guardar.';
      setFormErr(msg);
      setListErr(msg);
    },
  });

  const presentationOptions = useMemo(() => {
    const rows = q.data ?? [];
    return [...new Set(rows.map((r) => r.presentation))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    );
  }, [q.data]);

  const filteredMedicines = useMemo(() => {
    const rows = q.data ?? [];
    let out = rows;
    if (medEstado !== 'all') {
      const want = medEstado === 'active';
      out = out.filter((r) => r.isActive === want);
    }
    if (presentationFilter !== 'all') {
      out = out.filter((r) => r.presentation === presentationFilter);
    }
    const s = medSearch.trim().toLowerCase();
    if (s) {
      out = out.filter((r) =>
        [
          r.name,
          r.presentation,
          r.concentration,
          r.administrationRoute,
          r.inventoryUnit,
          r.expirationDate ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(s),
      );
    }
    return out;
  }, [q.data, medSearch, medEstado, presentationFilter]);

  const columns = useMemo(
    () => [
      medColHelper.accessor('name', {
        header: 'Nombre',
        cell: (c) => <span className="font-medium">{c.getValue()}</span>,
      }),
      medColHelper.accessor('presentation', { header: 'Presentación' }),
      medColHelper.accessor('concentration', { header: 'Concentración' }),
      medColHelper.accessor('administrationRoute', { header: 'Vía' }),
      medColHelper.accessor('inventoryUnit', { header: 'Unidad' }),
      medColHelper.accessor('expirationDate', {
        header: 'Vencimiento',
        cell: (c) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {fmtVencimiento(c.getValue())}
          </span>
        ),
      }),
      medColHelper.accessor('isActive', {
        header: 'Estado',
        cell: (c) => <ActiveBadge active={c.getValue()} />,
      }),
      medColHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => {
                setEdit(row.original);
                setFormErr(null);
              }}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Editar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                const next = !row.original.isActive;
                const msg = next
                  ? '¿Reactivar este ítem en el catálogo?'
                  : '¿Desactivar este medicamento/insumo? No podrá usarse en nuevas consultas.';
                if (!window.confirm(msg)) return;
                patchM.mutate({ id: row.original.id, body: { isActive: next } });
              }}
            >
              {row.original.isActive ? 'Desactivar' : 'Reactivar'}
            </Button>
          </div>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: filteredMedicines,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const medRawCount = q.data?.length ?? 0;
  const medEmptyHint =
    medRawCount === 0
      ? 'Sin registros.'
      : 'Ningún resultado con estos filtros. Ajustá la búsqueda o los filtros.';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Medicamentos e insumos prescribibles. La tabla admite ordenar por columnas.
        </p>
        <Button
          type="button"
          className="gap-2"
          onClick={() => {
            setFormErr(null);
            setAddOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo ítem
        </Button>
      </div>

      {q.isError ? (
        <p className="text-sm text-destructive">No se pudo cargar el catálogo.</p>
      ) : null}
      {listErr ? (
        <p className="text-sm text-destructive" role="alert">
          {listErr}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative min-w-0 space-y-2 sm:col-span-2">
          <Label htmlFor="inv-med-search">Buscar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="inv-med-search"
              className="pl-9"
              value={medSearch}
              onChange={(e) => setMedSearch(e.target.value)}
              placeholder="Nombre, presentación, concentración, vía, unidad…"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="inv-med-estado">Estado</Label>
          <select
            id="inv-med-estado"
            className={selectClass}
            value={medEstado}
            onChange={(e) => setMedEstado(e.target.value as typeof medEstado)}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="inv-med-pres-f">Presentación</Label>
          <select
            id="inv-med-pres-f"
            className={selectClass}
            value={presentationFilter}
            onChange={(e) => setPresentationFilter(e.target.value)}
          >
            <option value="all">Todas</option>
            {presentationOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[1020px] text-left text-sm">
          <thead className="border-b bg-muted/40">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-3 py-2 font-medium">
                    {h.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn(
                          'inline-flex items-center gap-1',
                          h.column.getCanSort() ? 'cursor-pointer select-none hover:underline' : '',
                        )}
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === 'asc'
                          ? ' ▲'
                          : h.column.getIsSorted() === 'desc'
                            ? ' ▼'
                            : null}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {q.isLoading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  {medEmptyHint}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {addOpen ? (
        <MedicineFormModal
          key="inv-med-add"
          title="Nuevo medicamento / insumo"
          submitLabel="Crear"
          busy={createM.isPending}
          error={formErr}
          onClose={() => !createM.isPending && setAddOpen(false)}
          onSubmit={(payload) =>
            createM.mutate({
              name: payload.name,
              presentation: payload.presentation,
              concentration: payload.concentration,
              administrationRoute: payload.administrationRoute,
              inventoryUnit: payload.inventoryUnit,
              ...(typeof payload.expirationDate === 'string' && payload.expirationDate
                ? { expirationDate: payload.expirationDate }
                : {}),
            })
          }
        />
      ) : null}

      {edit ? (
        <MedicineFormModal
          key={edit.id}
          title="Editar medicamento / insumo"
          submitLabel="Guardar"
          busy={patchM.isPending}
          error={formErr}
          initial={edit}
          onClose={() => !patchM.isPending && setEdit(null)}
          onSubmit={(payload) =>
            patchM.mutate({
              id: edit.id,
              body: {
                name: payload.name,
                presentation: payload.presentation,
                concentration: payload.concentration,
                administrationRoute: payload.administrationRoute,
                inventoryUnit: payload.inventoryUnit,
                expirationDate: payload.expirationDate ?? null,
              },
            })
          }
        />
      ) : null}
    </div>
  );
}

type MedFormPayload = {
  name: string;
  presentation: (typeof SO_MEDICINE_PRESENTATIONS)[number];
  concentration: string;
  administrationRoute: (typeof SO_MEDICINE_ADMIN_ROUTES)[number];
  inventoryUnit: (typeof SO_MEDICINE_INVENTORY_UNITS)[number];
  /** Alta: ausente o cadena. Edición: cadena o `null` para borrar. */
  expirationDate?: string | null;
};

function MedicineFormModal({
  title,
  submitLabel,
  busy,
  error,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  initial?: SoInventarioMedicine;
  onClose: () => void;
  onSubmit: (p: MedFormPayload) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [concentration, setConcentration] = useState(initial?.concentration ?? '');
  const [presentation, setPresentation] = useState<string>(
    initial?.presentation ?? SO_MEDICINE_PRESENTATIONS[0],
  );
  const [administrationRoute, setAdministrationRoute] = useState<string>(
    initial?.administrationRoute ?? SO_MEDICINE_ADMIN_ROUTES[0],
  );
  const [inventoryUnit, setInventoryUnit] = useState<string>(
    initial?.inventoryUnit ?? SO_MEDICINE_INVENTORY_UNITS[0],
  );
  const [expirationDate, setExpirationDate] = useState(
    () => initial?.expirationDate?.slice(0, 10) ?? '',
  );
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    setName(initial?.name ?? '');
    setConcentration(initial?.concentration ?? '');
    setPresentation(initial?.presentation ?? SO_MEDICINE_PRESENTATIONS[0]);
    setAdministrationRoute(initial?.administrationRoute ?? SO_MEDICINE_ADMIN_ROUTES[0]);
    setInventoryUnit(initial?.inventoryUnit ?? SO_MEDICINE_INVENTORY_UNITS[0]);
    setExpirationDate(initial?.expirationDate?.slice(0, 10) ?? '');
  }, [initial]);

  function submit() {
    const n = name.trim();
    const c = concentration.trim();
    if (!n || !c) {
      setLocalErr('Nombre y concentración son obligatorios.');
      return;
    }
    setLocalErr(null);
    const exp = expirationDate.trim();
    const base: MedFormPayload = {
      name: n,
      concentration: c,
      presentation: presentation as MedFormPayload['presentation'],
      administrationRoute: administrationRoute as MedFormPayload['administrationRoute'],
      inventoryUnit: inventoryUnit as MedFormPayload['inventoryUnit'],
    };
    if (initial) {
      onSubmit({
        ...base,
        expirationDate: exp === '' ? null : exp,
      });
    } else {
      onSubmit(exp === '' ? base : { ...base, expirationDate: exp });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex max-h-[100dvh] items-center justify-center overflow-y-auto bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="my-4 w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="inv-med-name">Nombre</Label>
            <Input
              id="inv-med-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-med-pres">Presentación</Label>
            <select
              id="inv-med-pres"
              className={selectClass}
              value={presentation}
              onChange={(e) => setPresentation(e.target.value)}
              disabled={busy}
            >
              {SO_MEDICINE_PRESENTATIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-med-conc">Concentración</Label>
            <Input
              id="inv-med-conc"
              value={concentration}
              onChange={(e) => setConcentration(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="inv-med-route">Vía de administración</Label>
            <select
              id="inv-med-route"
              className={selectClass}
              value={administrationRoute}
              onChange={(e) => setAdministrationRoute(e.target.value)}
              disabled={busy}
            >
              {SO_MEDICINE_ADMIN_ROUTES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="inv-med-unit">Unidad de inventario</Label>
            <select
              id="inv-med-unit"
              className={selectClass}
              value={inventoryUnit}
              onChange={(e) => setInventoryUnit(e.target.value)}
              disabled={busy}
            >
              {SO_MEDICINE_INVENTORY_UNITS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="inv-med-exp">Fecha de vencimiento</Label>
            <Input
              id="inv-med-exp"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Podés dejarlo vacío o borrarlo al editar.
            </p>
          </div>
        </div>
        {localErr || error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {localErr ?? error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Guardando…' : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function InventarioMedicoView() {
  const [tab, setTab] = useState<'dx' | 'med'>('dx');

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 pb-24">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Inventario médico</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administración de catálogos de diagnósticos y medicamentos para el módulo de salud
          ocupacional.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Secciones de inventario"
        className="flex gap-2 rounded-xl border border-border bg-muted/40 p-1.5 shadow-inner"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'dx'}
          id="inv-tab-dx"
          aria-controls="inv-panel"
          className={cn(
            'flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring',
            tab === 'dx'
              ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/25'
              : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
          )}
          onClick={() => setTab('dx')}
        >
          Diagnósticos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'med'}
          id="inv-tab-med"
          aria-controls="inv-panel"
          className={cn(
            'flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring',
            tab === 'med'
              ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/25'
              : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
          )}
          onClick={() => setTab('med')}
        >
          Medicamentos
        </button>
      </div>

      <Card>
        <CardContent id="inv-panel" role="tabpanel" aria-labelledby={tab === 'dx' ? 'inv-tab-dx' : 'inv-tab-med'} className="pt-6">
          {tab === 'dx' ? <DiagnosesPanel /> : <MedicinesPanel />}
        </CardContent>
      </Card>
    </div>
  );
}
