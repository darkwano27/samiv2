/**
 * Administración → Gestión de usuarios.
 * Pestañas: Trabajadores (directorio SAP) | Admins por módulo (resumen RBAC).
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  fetchWorkersDirectory,
  isForbiddenError,
  isServiceUnavailableError,
} from '@/modules/admin/repository/admin.api-repository';
import { WorkerDirectoryTable } from '@/modules/admin/components/WorkerDirectoryTable';
import { ModuleAdminsTab } from '@/modules/admin/components/ModuleAdminsTab';
import { cn } from '@/lib/utils';

type GestionUsuariosTabId = 'trabajadores' | 'admins-modulo';

export function GestionUsuariosPage() {
  const [tab, setTab] = useState<GestionUsuariosTabId>('trabajadores');

  const q = useQuery({
    queryKey: ['admin', 'workers', 'directory'],
    queryFn: fetchWorkersDirectory,
    retry: false,
  });

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Gestión de usuarios
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Administración RBAC para <strong>superadmin</strong>: directorio de trabajadores, asignación
          de <strong>admin por módulo</strong> (pestaña Admins por módulo) y, en la siguiente
          iteración, el panel lateral para roles finos por trabajador.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Secciones de gestión de usuarios"
        className="mb-6 flex gap-1 border-b border-border"
      >
        <button
          type="button"
          role="tab"
          id="tab-trabajadores"
          aria-selected={tab === 'trabajadores'}
          className={cn(
            'relative -mb-px px-4 py-2.5 text-sm font-medium transition-colors',
            tab === 'trabajadores'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setTab('trabajadores')}
        >
          Trabajadores
          {tab === 'trabajadores' ? (
            <span
              className="absolute right-4 bottom-0 left-4 h-0.5 rounded-full bg-primary"
              aria-hidden
            />
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          id="tab-admins-modulo"
          aria-selected={tab === 'admins-modulo'}
          className={cn(
            'relative -mb-px px-4 py-2.5 text-sm font-medium transition-colors',
            tab === 'admins-modulo'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setTab('admins-modulo')}
        >
          Admins por módulo
          {tab === 'admins-modulo' ? (
            <span
              className="absolute right-4 bottom-0 left-4 h-0.5 rounded-full bg-primary"
              aria-hidden
            />
          ) : null}
        </button>
      </div>

      <div
        role="tabpanel"
        id="panel-trabajadores"
        aria-labelledby="tab-trabajadores"
        hidden={tab !== 'trabajadores'}
        className={tab !== 'trabajadores' ? 'hidden' : undefined}
      >
        <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
          Directorio de trabajadores activos en SAP. <strong>Acceso</strong>: AD (correo
          corporativo) o Local. <strong>Estado</strong>: activo si ya puede entrar (AD o cuenta
          local creada); pendiente si aún debe completar el registro local. Las cuentas{' '}
          <strong>locales</strong> se bloquean tras varios intentos fallidos de contraseña; un
          superadmin puede desbloquearlas desde la columna Acciones.
        </p>

        {q.isPending ? (
          <p className="text-sm text-muted-foreground">Cargando directorio…</p>
        ) : null}

        {q.isError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {isForbiddenError(q.error) ? (
              <>
                No tenés permisos para ver el directorio. La API solo lo expone a usuarios{' '}
                <strong>superadmin</strong>.
              </>
            ) : isServiceUnavailableError(q.error) ? (
              <>El maestro SAP no está disponible en este entorno. Probá más tarde.</>
            ) : (
              <>
                No se pudo cargar el directorio.{' '}
                {q.error instanceof Error ? q.error.message : 'Error desconocido'}
              </>
            )}
          </div>
        ) : null}

        {q.isSuccess ? (
          <>
            <p className="mb-4 text-xs text-muted-foreground">
              Catálogo cargado: {q.data.workers.length} trabajador(es) activo(s) en SAP. Usá
              búsqueda, filtros y paginación para recorrer el listado.
            </p>
            <WorkerDirectoryTable data={q.data.workers} />
          </>
        ) : null}
      </div>

      <div
        role="tabpanel"
        id="panel-admins-modulo"
        aria-labelledby="tab-admins-modulo"
        hidden={tab !== 'admins-modulo'}
        className={tab !== 'admins-modulo' ? 'hidden' : undefined}
      >
        <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
          Mismos módulos que en el menú lateral (Horas extra, Salud ocupacional, Visitas, etc.). Podés{' '}
          <strong>asignar un admin del módulo</strong> con el código SAP del trabajador (rol{' '}
          <code className="text-xs">module-admin</code> sobre la app de gestión de ese módulo). El
          trabajador debe existir en la tabla <code className="text-xs">workers</code>.
        </p>
        <ModuleAdminsTab />
      </div>
    </div>
  );
}
