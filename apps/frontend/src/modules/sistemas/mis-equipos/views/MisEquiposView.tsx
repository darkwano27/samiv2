import { useQuery } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { PackageCheck, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  abReadonlyAssetColumnDefs,
  formatDisplayDate,
  AssetDescripcionBlock,
} from '@/modules/sistemas/shared/ab-asset-columns';
import type { AbAssetRow } from '@/modules/sistemas/asignacion-bienes/repository/asignacion-bienes.api-repository';
import {
  meFetchMyAssets,
  meFetchMyGlpiUser,
  readMeEquiposApiMessage,
} from '../repository/mis-equipos.api-repository';
import { useIsMdUp } from '@/shared/hooks/use-is-md-up';

const EMPTY_ASSET_ROWS: AbAssetRow[] = [];

export function MisEquiposView() {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'fecha_asignacion', desc: true }]);
  const [pageError, setPageError] = useState<string | null>(null);

  const glpiUserQ = useQuery({
    queryKey: ['sistemas', 'mis-equipos', 'glpi-user'],
    queryFn: () => meFetchMyGlpiUser(),
    staleTime: 60_000,
  });

  const assetsQ = useQuery({
    queryKey: ['sistemas', 'mis-equipos', 'assets'],
    queryFn: () => meFetchMyAssets(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!assetsQ.isError) {
      setPageError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const msg = (await readMeEquiposApiMessage(assetsQ.error)) ?? 'No se pudieron cargar los equipos.';
      if (!cancelled) setPageError(msg);
    })();
    return () => {
      cancelled = true;
    };
  }, [assetsQ.isError, assetsQ.errorUpdatedAt]);

  const isMdUp = useIsMdUp();

  const columns = useMemo(() => abReadonlyAssetColumnDefs(), []);

  const tableData = useMemo(
    () => assetsQ.data?.items ?? EMPTY_ASSET_ROWS,
    [assetsQ.data?.items],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const assetRows = table.getRowModel().rows;
  const glpiLinked = glpiUserQ.data != null;
  const glpiLabel =
    glpiUserQ.data?.realname?.trim() ||
    [glpiUserQ.data?.firstname, glpiUserQ.data?.name].filter(Boolean).join(' ').trim() ||
    (glpiUserQ.data ? `ID ${glpiUserQ.data.id}` : null);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 p-3 sm:gap-6 sm:p-4 md:p-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
            Mis equipos
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Equipos de inventario asignados.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Actualizar inventario</CardTitle>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 gap-1.5 touch-manipulation"
              disabled={assetsQ.isFetching || glpiUserQ.isFetching}
              onClick={() => {
                void assetsQ.refetch();
                void glpiUserQ.refetch();
              }}
            >
              <RefreshCw
                className={cn('h-4 w-4', (assetsQ.isFetching || glpiUserQ.isFetching) && 'animate-spin')}
                aria-hidden
              />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {glpiUserQ.isLoading ? (
            <p className="text-muted-foreground">Buscando tu usuario en el inventario…</p>
          ) : glpiLinked ? (
            <p className="text-emerald-800 dark:text-emerald-200">
              Equipos asociados a: {glpiLabel}
            </p>
          ) : (
            <p className="text-amber-800 dark:text-amber-200">
              No encontramos tu código SAP en el inventario de equipos. Si debería aparecer, contactá a
              sistemas.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Equipos asignados</CardTitle>
          <CardDescription>Lista según GLPI para tu SAP.</CardDescription>
        </CardHeader>
        <CardContent>
          {pageError ? (
            <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {pageError}
            </p>
          ) : null}
          {assetsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando la lista…</p>
          ) : !glpiLinked ? (
            <p className="text-sm text-muted-foreground">
              No hay lista para mostrar hasta que exista vínculo con el inventario.
            </p>
          ) : tableData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tenés equipos cargados a tu nombre en el inventario.
            </p>
          ) : isMdUp ? (
            <div className="md:-mx-1 md:max-w-full md:overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr
                      key={hg.id}
                      className="border-b border-border text-xs uppercase text-muted-foreground"
                    >
                      {hg.headers.map((h) => (
                        <th key={h.id} className="px-2 py-2 font-medium sm:px-3">
                          {h.isPlaceholder ? null : (
                            <button
                              type="button"
                              className={cn(
                                'inline-flex min-h-10 touch-manipulation items-center gap-1 rounded-md px-1 py-1',
                                h.column.getCanSort() &&
                                  'cursor-pointer select-none hover:text-foreground',
                              )}
                              onClick={h.column.getToggleSortingHandler()}
                            >
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {h.column.getIsSorted() === 'asc'
                                ? ' ↑'
                                : h.column.getIsSorted() === 'desc'
                                  ? ' ↓'
                                  : null}
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {assetRows.map((row) => (
                    <tr key={row.id} className="border-b border-border/80">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-2 py-3 align-top sm:px-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              {assetRows.map((row) => {
                const a = row.original;
                return (
                  <Card key={row.id} className="border-border/80 shadow-none">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Fecha asignación
                        </span>
                        <span className="tabular-nums text-sm">
                          {formatDisplayDate(a.fecha_asignacion)}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Categoría
                        </p>
                        <p className="mt-0.5 break-words text-sm font-medium">
                          {a.categoria ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Descripción
                        </p>
                        <div className="mt-1">
                          <AssetDescripcionBlock row={a} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
