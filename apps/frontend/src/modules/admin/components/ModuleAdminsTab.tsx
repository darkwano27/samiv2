/**
 * Pestaña "Admins por módulo": mismos módulos que el sidebar (`MODULES`); asignación de
 * `module-admin` por código SAP (superadmin).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  fetchModulesSummary,
  fetchRbacCatalog,
  isForbiddenError,
  readAdminServerMessage,
  revokeRbacAssignment,
} from '@/modules/admin/repository/admin.api-repository';
import { AssignModuleAdminDialog, findModuleAdminRoleId } from '@/modules/admin/components/AssignModuleAdminDialog';
import { ModuleAdminCard } from '@/modules/admin/components/ModuleAdminCard';
import type { ModuleSummaryItem } from '@/modules/admin/types/modules-summary.types';
import { Button } from '@/components/ui/button';
import { MODULES } from '@/shared/components/sidebar/navigation-config';

export function ModuleAdminsTab() {
  const queryClient = useQueryClient();
  const [assignSlug, setAssignSlug] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const assignLabel =
    assignSlug === null ? '' : (MODULES.find((m) => m.slug === assignSlug)?.label ?? assignSlug);

  const revokeMut = useMutation({
    mutationFn: revokeRbacAssignment,
    onSuccess: () => {
      setRevokeError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'rbac', 'modules-summary'] });
    },
    onError: async (e: unknown) => {
      const msg =
        (await readAdminServerMessage(e)) ??
        (e instanceof Error ? e.message : 'No se pudo quitar el admin del módulo.');
      setRevokeError(msg);
    },
  });

  function confirmRevokeAdmin(assignmentId: string, displayName: string) {
    setRevokeError(null);
    if (
      !window.confirm(
        `¿Quitar a ${displayName} como administrador de este módulo? Perderá el rol module-admin en la app de gestión.`,
      )
    ) {
      return;
    }
    revokeMut.mutate(assignmentId);
  }

  const q = useQuery({
    queryKey: ['admin', 'rbac', 'modules-summary'],
    queryFn: fetchModulesSummary,
    retry: false,
  });

  const catalogQ = useQuery({
    queryKey: ['admin', 'rbac', 'catalog'],
    queryFn: fetchRbacCatalog,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const mergedModules: ModuleSummaryItem[] = useMemo(() => {
    if (!q.isSuccess) return [];
    const map = new Map(q.data.modules.map((m) => [m.module_slug, m]));
    return MODULES.map((nav) => {
      const s = map.get(nav.slug);
      return {
        module_slug: nav.slug,
        module_label: nav.label,
        app_count: nav.apps.length,
        admins: s?.admins ?? [],
        role_summary: s?.role_summary ?? [],
        total_workers_with_roles: s?.total_workers_with_roles ?? 0,
      };
    });
  }, [q.isSuccess, q.data]);

  const existingAdminSapCodesForDialog = useMemo(() => {
    if (!assignSlug) return [];
    return (
      mergedModules.find((m) => m.module_slug === assignSlug)?.admins.map((a) => a.sap_code) ?? []
    );
  }, [assignSlug, mergedModules]);

  return (
    <div>
      {q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-xl bg-muted/60"
              aria-hidden
            />
          ))}
        </div>
      ) : null}

      {q.isError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {isForbiddenError(q.error) ? (
            <>No tenés permisos para ver este resumen.</>
          ) : (
            <>
              No se pudo cargar el resumen.{' '}
              {q.error instanceof Error ? q.error.message : 'Error desconocido'}
            </>
          )}
          <div className="mt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => void q.refetch()}>
              Reintentar
            </Button>
          </div>
        </div>
      ) : null}

      {q.isSuccess ? (
        <>
          {revokeError ? (
            <p
              className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {revokeError}
            </p>
          ) : null}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {mergedModules.map((m) => {
              const canAssign =
                catalogQ.isSuccess &&
                'roleId' in findModuleAdminRoleId(catalogQ.data, m.module_slug);
              return (
                <ModuleAdminCard
                  key={m.module_slug}
                  module={m}
                  onAssignAdmin={() => setAssignSlug(m.module_slug)}
                  assignDisabled={!catalogQ.isSuccess || !canAssign}
                  assignDisabledTitle={
                    catalogQ.isPending
                      ? 'Cargando catálogo RBAC…'
                      : !canAssign
                        ? 'Falta app de gestión o rol module-admin en catálogo (ejecutá seed:rbac).'
                        : undefined
                  }
                  onRevokeAdmin={confirmRevokeAdmin}
                  revokeDisabled={revokeMut.isPending}
                />
              );
            })}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Los módulos coinciden con el menú lateral. El conteo de apps es el de las aplicaciones
            visibles en navegación; el resumen de roles usa asignaciones en el catálogo RBAC (apps
            registradas en base de datos).
          </p>
        </>
      ) : null}

      <AssignModuleAdminDialog
        open={assignSlug !== null}
        onClose={() => setAssignSlug(null)}
        moduleSlug={assignSlug ?? ''}
        moduleLabel={assignLabel}
        catalog={catalogQ.data}
        existingAdminSapCodes={existingAdminSapCodesForDialog}
      />
    </div>
  );
}
