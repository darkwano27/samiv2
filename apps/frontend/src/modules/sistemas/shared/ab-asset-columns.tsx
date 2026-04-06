import { createColumnHelper } from '@tanstack/react-table';
import { memo } from 'react';
import type { AbAssetRow } from '@/modules/sistemas/asignacion-bienes/repository/asignacion-bienes.api-repository';

export function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  if (!d) return '—';
  try {
    const [y, m, day] = d.split('-');
    if (!y || !m || !day) return iso;
    return `${day}/${m}/${y}`;
  } catch {
    return iso;
  }
}

export const abAssetColHelper = createColumnHelper<AbAssetRow>();

function trimVal(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t.length ? t : null;
}

export function descripcionSortKey(row: AbAssetRow): string {
  return [
    trimVal(row.name),
    trimVal(row.tipo),
    trimVal(row.marca),
    trimVal(row.modelo),
    trimVal(row.serial),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export const AssetDescripcionBlock = memo(function AssetDescripcionBlock({ row }: { row: AbAssetRow }) {
  const name = trimVal(row.name);
  const tipo = trimVal(row.tipo);
  const marca = trimVal(row.marca);
  const modelo = trimVal(row.modelo);
  const serie = trimVal(row.serial);
  const hasAny = name || tipo || marca || modelo || serie;

  if (!hasAny) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="min-w-0 max-w-full space-y-1 text-sm leading-snug">
      {name ? (
        <p className="break-words font-medium text-foreground">{name}</p>
      ) : null}
      <dl className="grid gap-x-3 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
        {tipo ? (
          <div className="min-w-0">
            <dt className="inline font-medium text-foreground/80">Tipo</dt>{' '}
            <dd className="inline break-words">{tipo}</dd>
          </div>
        ) : null}
        {marca ? (
          <div className="min-w-0">
            <dt className="inline font-medium text-foreground/80">Marca</dt>{' '}
            <dd className="inline break-words">{marca}</dd>
          </div>
        ) : null}
        {modelo ? (
          <div className="min-w-0">
            <dt className="inline font-medium text-foreground/80">Modelo</dt>{' '}
            <dd className="inline break-words">{modelo}</dd>
          </div>
        ) : null}
        {serie ? (
          <div className="min-w-0 sm:col-span-2">
            <dt className="inline font-medium text-foreground/80">Serie</dt>{' '}
            <dd className="inline break-words font-mono">{serie}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
});

export function abReadonlyAssetColumnDefs() {
  return [
    abAssetColHelper.accessor('fecha_asignacion', {
      id: 'fecha_asignacion',
      header: 'Fecha asignación',
      cell: (ctx) => (
        <span className="whitespace-nowrap tabular-nums text-sm">
          {formatDisplayDate(ctx.getValue())}
        </span>
      ),
    }),
    abAssetColHelper.accessor('categoria', {
      header: 'Categoría',
      cell: (ctx) => (
        <span className="max-w-[min(100%,10rem)] break-words text-sm font-medium">
          {ctx.getValue() ?? '—'}
        </span>
      ),
    }),
    abAssetColHelper.accessor((row) => descripcionSortKey(row), {
      id: 'descripcion',
      header: 'Descripción',
      sortingFn: (a, b) =>
        descripcionSortKey(a.original).localeCompare(descripcionSortKey(b.original), 'es'),
      cell: ({ row }) => <AssetDescripcionBlock row={row.original} />,
    }),
  ];
}
