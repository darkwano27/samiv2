/**
 * Tabla de directorio de trabajadores (TanStack Table).
 * Paginación, búsqueda, filtros y desbloqueo de cuentas locales bloqueadas.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import { unlockLocalAuth } from '@/modules/admin/repository/admin.api-repository';
import type { WorkerDirectoryRow } from '@/modules/admin/types/worker-directory.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const columnHelper = createColumnHelper<WorkerDirectoryRow>();

const selectTriggerClass = cn(
  'h-11 w-full min-w-[8rem] rounded-md border border-input bg-background px-3 py-2 text-sm outline-none',
  'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
  'disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 md:text-sm',
);

function accessLabel(access: WorkerDirectoryRow['access']): string {
  return access === 'ad' ? 'AD' : 'Local';
}

function statusLabel(status: WorkerDirectoryRow['status']): string {
  return status === 'activo' ? 'Activo' : 'Pendiente';
}

function statusStyles(status: WorkerDirectoryRow['status']): string {
  return status === 'activo'
    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
    : 'bg-amber-500/15 text-amber-900 dark:text-amber-100';
}

function UnlockCell({ sapCode }: { sapCode: string }) {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: () => unlockLocalAuth(sapCode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'workers', 'directory'] });
    },
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={m.isPending}
      onClick={() => m.mutate()}
    >
      {m.isPending ? '…' : 'Desbloquear'}
    </Button>
  );
}

type Props = {
  data: WorkerDirectoryRow[];
};

export function WorkerDirectoryTable({ data }: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'sap_code', desc: false },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [search, setSearch] = useState('');
  const [accessFilter, setAccessFilter] = useState<'all' | 'ad' | 'local'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'activo' | 'pendiente'>('all');

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((row) => {
      if (accessFilter !== 'all' && row.access !== accessFilter) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (q) {
        const hay = `${row.sap_code} ${row.nombre} ${row.apellido}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, accessFilter, statusFilter, search]);

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [accessFilter, statusFilter, search]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('sap_code', {
        id: 'sap_code',
        header: 'Cód. trabajador',
        cell: (info) => (
          <span className="font-mono text-sm tabular-nums">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: 'full_name',
        header: 'Nombre y apellido',
        sortingFn: (rowA, rowB) => {
          const a = `${rowA.original.nombre} ${rowA.original.apellido}`.trim();
          const b = `${rowB.original.nombre} ${rowB.original.apellido}`.trim();
          return a.localeCompare(b, 'es');
        },
        cell: ({ row }) => {
          const { nombre, apellido } = row.original;
          const full = `${nombre} ${apellido}`.trim();
          return full || '—';
        },
      }),
      columnHelper.accessor('access', {
        header: 'Acceso',
        cell: (info) => (
          <span className="text-sm font-medium">{accessLabel(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Estado',
        cell: (info) => {
          const v = info.getValue();
          return (
            <span
              className={cn(
                'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                statusStyles(v),
              )}
            >
              {statusLabel(v)}
            </span>
          );
        },
      }),
      columnHelper.accessor('local_account_locked', {
        header: 'Cuenta local',
        cell: (info) => {
          if (!info.getValue()) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <span className="inline-flex rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
              Bloqueada
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) =>
          row.original.local_account_locked ? (
            <UnlockCell sapCode={row.original.sap_code} />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageCount = table.getPageCount();
  const total = filteredData.length;
  const start =
    total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const end = Math.min(
    (pagination.pageIndex + 1) * pagination.pageSize,
    total,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[min(100%,20rem)] flex-1 space-y-2">
          <Label htmlFor="worker-dir-search">Buscar</Label>
          <Input
            id="worker-dir-search"
            type="search"
            placeholder="Código, nombre o apellido…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="grid min-w-[10rem] gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="worker-dir-access">Acceso</Label>
            <select
              id="worker-dir-access"
              className={selectTriggerClass}
              value={accessFilter}
              onChange={(e) =>
                setAccessFilter(e.target.value as 'all' | 'ad' | 'local')
              }
            >
              <option value="all">Todos</option>
              <option value="ad">AD</option>
              <option value="local">Local</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="worker-dir-status">Estado</Label>
            <select
              id="worker-dir-status"
              className={selectTriggerClass}
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'activo' | 'pendiente')
              }
            >
              <option value="all">Todos</option>
              <option value="activo">Activo</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {total === 0
          ? 'Sin resultados con los filtros actuales.'
          : `Mostrando ${start}–${end} de ${total} resultado(s).`}
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-muted/50">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 font-semibold text-foreground"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn(
                          'inline-flex items-center gap-1 select-none',
                          header.column.getCanSort() &&
                            'cursor-pointer hover:text-primary',
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? ' ↑' : null}
                        {header.column.getIsSorted() === 'desc' ? ' ↓' : null}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No hay filas para mostrar.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/80 transition-colors hover:bg-muted/30"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-2.5 align-middle text-foreground"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Label htmlFor="worker-dir-page-size" className="whitespace-nowrap">
            Filas por página
          </Label>
          <select
            id="worker-dir-page-size"
            className={cn(selectTriggerClass, 'h-9 w-auto min-w-[4.5rem] py-1')}
            value={pagination.pageSize}
            onChange={(e) => {
              const n = Number(e.target.value);
              setPagination({ pageIndex: 0, pageSize: n });
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Página {pageCount === 0 ? 0 : pagination.pageIndex + 1} /{' '}
            {Math.max(pageCount, 1)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
