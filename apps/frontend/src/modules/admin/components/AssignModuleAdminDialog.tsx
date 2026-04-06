/**
 * Asigna rol `module-admin` eligiendo trabajador desde el mismo directorio SAP que la pestaña Trabajadores.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { useEffect, useMemo, useState } from 'react';
import {
  assignWorkerRole,
  fetchWorkersDirectory,
  isConflictError,
  isForbiddenError,
  isNotFoundError,
  isServiceUnavailableError,
} from '@/modules/admin/repository/admin.api-repository';
import type { RbacCatalogResponse } from '@/modules/admin/types/rbac-catalog.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function findModuleAdminRoleId(
  catalog: RbacCatalogResponse,
  moduleSlug: string,
): { roleId: string } | { error: string } {
  const app = catalog.apps.find(
    (a) => a.module_slug === moduleSlug && a.is_management,
  );
  if (!app) {
    return {
      error:
        'No hay app de gestión en el catálogo RBAC para este módulo. Ejecutá seed:rbac en el backend.',
    };
  }
  const role = catalog.roles.find(
    (r) => r.app_id === app.id && r.slug === 'module-admin',
  );
  if (!role) {
    return { error: 'No hay rol module-admin para la app de gestión de este módulo.' };
  }
  return { roleId: role.id };
}

async function readServerMessage(e: unknown): Promise<string | undefined> {
  if (!(e instanceof HTTPError)) return undefined;
  try {
    const b = (await e.response.json()) as { message?: string };
    return typeof b.message === 'string' ? b.message : undefined;
  } catch {
    return undefined;
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  moduleSlug: string;
  moduleLabel: string;
  catalog: RbacCatalogResponse | undefined;
  /** Códigos SAP que ya figuran como admin de este módulo (se excluyen del listado). */
  existingAdminSapCodes: string[];
};

export function AssignModuleAdminDialog({
  open,
  onClose,
  moduleSlug,
  moduleLabel,
  catalog,
  existingAdminSapCodes,
}: Props) {
  const [search, setSearch] = useState('');
  const [selectedSapCode, setSelectedSapCode] = useState<string | null>(null);
  const [manualSap, setManualSap] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const dirQ = useQuery({
    queryKey: ['admin', 'workers', 'directory'],
    queryFn: fetchWorkersDirectory,
    enabled: open,
    retry: false,
  });

  const existingSet = useMemo(
    () => new Set(existingAdminSapCodes.map((c) => c.trim()).filter(Boolean)),
    [existingAdminSapCodes],
  );

  const filteredWorkers = useMemo(() => {
    const list = dirQ.data?.workers ?? [];
    const q = search.trim().toLowerCase();
    return list
      .filter((row) => !existingSet.has(row.sap_code.trim()))
      .filter((row) => {
        if (!q) return true;
        const hay = `${row.sap_code} ${row.nombre} ${row.apellido}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [dirQ.data, search, existingSet]);

  const assignMutation = useMutation({
    mutationFn: async (workerId: string) => {
      if (!catalog) throw new Error('Catálogo no cargado');
      const found = findModuleAdminRoleId(catalog, moduleSlug);
      if ('error' in found) throw new Error(found.error);
      return assignWorkerRole({ worker_id: workerId.trim(), role_id: found.roleId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'rbac', 'modules-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['so', 'module-settings', 'members'] });
      setSearch('');
      setSelectedSapCode(null);
      setManualSap('');
      setLocalError(null);
      onClose();
    },
    onError: async (e: unknown) => {
      if (e instanceof Error && !('response' in e)) {
        setLocalError(e.message);
        return;
      }
      if (isNotFoundError(e)) {
        const msg = await readServerMessage(e);
        setLocalError(
          msg ??
            'No se encontró un trabajador activo con ese código en SAP (staging).',
        );
        return;
      }
      if (isConflictError(e)) {
        setLocalError('Este trabajador ya es admin de este módulo (misma asignación).');
        return;
      }
      const msg = await readServerMessage(e);
      setLocalError(msg ?? 'No se pudo asignar el rol.');
    },
  });

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSelectedSapCode(null);
    setManualSap('');
    setLocalError(null);
    assignMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir / cambiar módulo
  }, [open, moduleSlug]);

  if (!open) return null;

  const roleLookup = catalog ? findModuleAdminRoleId(catalog, moduleSlug) : null;
  const catalogBlocked = catalog && roleLookup && 'error' in roleLookup;

  const directoryOk = dirQ.isSuccess;

  function submitAssign() {
    setLocalError(null);
    const id = (selectedSapCode?.trim() || manualSap.trim());
    if (!id) {
      setLocalError(
        directoryOk
          ? 'Seleccioná un trabajador de la lista o usá el código SAP abajo.'
          : 'Ingresá el código SAP del trabajador.',
      );
      return;
    }
    assignMutation.mutate(id);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onClick={() => !assignMutation.isPending && onClose()}
    >
      <div
        role="dialog"
        aria-labelledby="assign-module-admin-title"
        aria-modal="true"
        className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="assign-module-admin-title" className="font-heading text-lg font-semibold">
          Asignar admin del módulo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Módulo: <strong className="text-foreground">{moduleLabel}</strong>. Rol{' '}
          <strong className="text-foreground">module-admin</strong> (app de gestión del módulo).
        </p>

        {!catalog ? (
          <p className="mt-4 text-sm text-muted-foreground">Cargando catálogo…</p>
        ) : null}

        {catalogBlocked ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {(roleLookup as { error: string }).error}
          </p>
        ) : null}

        {catalog && !catalogBlocked ? (
          <div className="mt-4 space-y-4">
            {dirQ.isPending ? (
              <p className="text-sm text-muted-foreground">Cargando directorio de trabajadores…</p>
            ) : null}

            {directoryOk ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="assign-admin-search">Buscar por código o nombre</Label>
                  <Input
                    id="assign-admin-search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSelectedSapCode(null);
                    }}
                    placeholder="Igual que en la pestaña Trabajadores…"
                    autoComplete="off"
                    disabled={assignMutation.isPending}
                  />
                </div>
                <div
                  className="max-h-52 overflow-y-auto rounded-md border border-border"
                  role="listbox"
                  aria-label="Trabajadores"
                >
                  {filteredWorkers.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      No hay coincidencias o todos los listados ya son admin de este módulo.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {filteredWorkers.map((w) => {
                        const full = `${w.nombre} ${w.apellido}`.trim() || '—';
                        const selected = selectedSapCode === w.sap_code;
                        return (
                          <li key={w.sap_code}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={selected}
                              className={cn(
                                'flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm transition-colors',
                                selected ? 'bg-primary/10' : 'hover:bg-muted/60',
                              )}
                              onClick={() => setSelectedSapCode(w.sap_code)}
                              disabled={assignMutation.isPending}
                            >
                              <span className="font-medium text-foreground">{full}</span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {w.sap_code}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            ) : null}

            {dirQ.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {isForbiddenError(dirQ.error)
                  ? 'Sin acceso al directorio. Usá el código SAP abajo.'
                  : isServiceUnavailableError(dirQ.error)
                    ? 'SAP no disponible. Usá el código SAP abajo si conocés el pernr.'
                    : 'No se pudo cargar el directorio. Usá el código SAP abajo o reintentá.'}
              </p>
            ) : null}

            {(directoryOk || dirQ.isError) && (
              <div className="space-y-2 border-t border-border pt-4">
                <Label htmlFor="assign-admin-manual">
                  {directoryOk ? 'O ingresá el código SAP a mano' : 'Código SAP (pernr)'}
                </Label>
                <Input
                  id="assign-admin-manual"
                  value={manualSap}
                  onChange={(e) => {
                    setManualSap(e.target.value);
                    if (e.target.value.trim()) setSelectedSapCode(null);
                  }}
                  placeholder="Ej. 52340"
                  autoComplete="off"
                  disabled={assignMutation.isPending}
                />
              </div>
            )}

            {localError ? (
              <p className="text-sm text-destructive" role="alert">
                {localError}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={assignMutation.isPending}
                onClick={() => {
                  onClose();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={assignMutation.isPending}
                onClick={() => submitAssign()}
              >
                {assignMutation.isPending ? 'Asignando…' : 'Asignar'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
