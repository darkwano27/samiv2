/**
 * Tab GLPI — MySQL solo lectura (credenciales persistidas, contraseña cifrada en servidor).
 * API: GET/PATCH/POST test `sistemas/module-settings/glpi-settings*`.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { ChevronDown, Database, PlugZap } from 'lucide-react';
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
import {
  invalidateSisModuleSettingsRelatedQueries,
  readSisModuleSettingsMessage,
  sisFetchGlpiSettings,
  sisPatchGlpiSettings,
  sisPostGlpiConnectionTest,
} from '../repository/sistemas-module-settings.api-repository';

export function SistemasGlpiSettingsTab() {
  const qc = useQueryClient();
  const glpiQ = useQuery({
    queryKey: ['sistemas', 'module-settings', 'glpi-settings'],
    queryFn: sisFetchGlpiSettings,
  });

  const [host, setHost] = useState('');
  const [port, setPort] = useState('3306');
  const [user, setUser] = useState('');
  const [database, setDatabase] = useState('');
  const [pass, setPass] = useState('');
  const [clearPassword, setClearPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadErrDetail, setLoadErrDetail] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [okDialogOpen, setOkDialogOpen] = useState(false);

  const hasPasswordStored = Boolean(glpiQ.data?.glpi_db_pass_configured);
  const mustSendPassword =
    !clearPassword && !hasPasswordStored && !pass.trim();

  useEffect(() => {
    if (glpiQ.isLoading) return;
    if (glpiQ.isError) {
      setPanelOpen(true);
      return;
    }
    setPanelOpen(glpiQ.data === null);
  }, [glpiQ.isLoading, glpiQ.isError, glpiQ.data]);

  useEffect(() => {
    if (!glpiQ.isError || !glpiQ.error) {
      setLoadErrDetail(null);
      return;
    }
    void readSisModuleSettingsMessage(glpiQ.error).then((m) => setLoadErrDetail(m ?? null));
  }, [glpiQ.isError, glpiQ.error]);

  useEffect(() => {
    if (glpiQ.isLoading) return;
    const d = glpiQ.data;
    if (!d) {
      setHost('');
      setPort('3306');
      setUser('');
      setDatabase('');
      setPass('');
      setClearPassword(false);
      return;
    }
    setHost(d.glpi_db_host);
    setPort(String(d.glpi_db_port));
    setUser(d.glpi_db_user);
    setDatabase(d.glpi_db_name);
    setPass('');
    setClearPassword(false);
  }, [glpiQ.data, glpiQ.isLoading]);

  const patchM = useMutation({
    mutationFn: () => {
      const p = Math.min(65535, Math.max(1, parseInt(port, 10) || 3306));
      const body = {
        glpi_db_host: host.trim(),
        glpi_db_port: p,
        glpi_db_user: user.trim(),
        glpi_db_name: database.trim(),
      };
      if (clearPassword) {
        return sisPatchGlpiSettings({ ...body, glpi_db_pass: '' });
      }
      if (pass.trim()) {
        return sisPatchGlpiSettings({ ...body, glpi_db_pass: pass.trim() });
      }
      return sisPatchGlpiSettings(body);
    },
    onSuccess: async () => {
      setFormError(null);
      setPass('');
      setClearPassword(false);
      setPanelOpen(false);
      await invalidateSisModuleSettingsRelatedQueries(qc);
      await qc.invalidateQueries({ queryKey: ['sistemas', 'module-settings', 'glpi-settings'] });
    },
    onError: async (e) => {
      setFormError((await readSisModuleSettingsMessage(e)) ?? 'No se pudo guardar la configuración.');
    },
  });

  const testM = useMutation({
    mutationFn: () => {
      const formComplete =
        host.trim().length > 0 && user.trim().length > 0 && database.trim().length > 0;
      if (formComplete) {
        const p = Math.min(65535, Math.max(1, parseInt(port, 10) || 3306));
        return sisPostGlpiConnectionTest({
          glpi_db_host: host.trim(),
          glpi_db_port: p,
          glpi_db_user: user.trim(),
          glpi_db_name: database.trim(),
          glpi_db_pass: pass.trim() || undefined,
        });
      }
      return sisPostGlpiConnectionTest({});
    },
    onSuccess: () => {
      setFormError(null);
      setOkDialogOpen(true);
    },
    onError: async (e) => {
      setFormError((await readSisModuleSettingsMessage(e)) ?? 'No se pudo probar la conexión.');
    },
  });

  const loading = glpiQ.isLoading;
  const busy = patchM.isPending || testM.isPending;
  const hostOk = Boolean(host.trim());
  const userOk = Boolean(user.trim());
  const dbOk = Boolean(database.trim());
  const portNum = Math.min(65535, Math.max(1, parseInt(port, 10) || 3306));
  const portOk = portNum >= 1 && portNum <= 65535;
  const canSave =
    !busy &&
    hostOk &&
    userOk &&
    dbOk &&
    portOk &&
    !mustSendPassword &&
    (pass.trim() || hasPasswordStored || clearPassword);

  const configSaved = glpiQ.data != null;
  const canTestSaved = !busy && configSaved && !glpiQ.isError;
  const formCompleteForInlineTest = hostOk && userOk && dbOk && portOk;
  const canTest =
    !busy &&
    !glpiQ.isError &&
    (canTestSaved || formCompleteForInlineTest);

  const loadHttpStatus =
    glpiQ.error instanceof HTTPError ? glpiQ.error.response.status : null;

  const summary =
    host.trim() && database.trim()
      ? `${host.trim()}:${portNum} · ${database.trim()}`
      : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3 pb-2">
          <button
            type="button"
            className="flex w-full min-w-0 items-start gap-3 rounded-lg text-left outline-none ring-offset-background transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 sm:items-center"
            onClick={() => setPanelOpen((o) => !o)}
            aria-expanded={panelOpen}
            aria-controls="sis-glpi-panel"
          >
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:mt-0" aria-hidden />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base leading-snug">
                  GLPI (MySQL — solo lectura)
                </CardTitle>
                {loading ? (
                  <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Cargando…
                  </span>
                ) : glpiQ.isError ? (
                  <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                    Error al cargar
                  </span>
                ) : glpiQ.data ? (
                  <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
                    Configurado
                  </span>
                ) : (
                  <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-100">
                    Sin configurar
                  </span>
                )}
              </div>
              {!panelOpen && summary && !glpiQ.isError ? (
                <p className="truncate text-xs text-muted-foreground">{summary}</p>
              ) : null}
            </div>
            <ChevronDown
              className={cn(
                'h-5 w-5 shrink-0 text-muted-foreground transition-transform',
                panelOpen && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        </CardHeader>
        <CardContent
          id="sis-glpi-panel"
          className={cn('space-y-4', !panelOpen && 'hidden')}
        >
          <CardDescription className="text-xs leading-relaxed">
            Credenciales para conectar al MySQL de GLPI en <strong>solo lectura</strong>. La
            contraseña se guarda cifrada; SAMI no la muestra en claro. Usá un usuario MySQL con
            permisos limitados a SELECT sobre las tablas necesarias.
          </CardDescription>
          {formError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : glpiQ.isError ? (
            <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">
                No se pudo cargar la configuración
                {loadHttpStatus ? ` (${loadHttpStatus})` : ''}.
              </p>
              {loadErrDetail ? (
                <p className="text-xs text-muted-foreground">{loadErrDetail}</p>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => void glpiQ.refetch()}>
                Reintentar
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sis-glpi-host">Host</Label>
                <Input
                  id="sis-glpi-host"
                  autoComplete="off"
                  className="min-h-11 font-mono text-sm"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  disabled={busy}
                  placeholder="servidor.mysql.ejemplo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sis-glpi-port">Puerto</Label>
                <Input
                  id="sis-glpi-port"
                  inputMode="numeric"
                  className="min-h-11 tabular-nums"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sis-glpi-db">Base de datos</Label>
                <Input
                  id="sis-glpi-db"
                  autoComplete="off"
                  className="min-h-11 font-mono text-sm"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  disabled={busy}
                  placeholder="glpidb"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sis-glpi-user">Usuario</Label>
                <Input
                  id="sis-glpi-user"
                  autoComplete="off"
                  className="min-h-11"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sis-glpi-pass">Contraseña</Label>
                <Input
                  id="sis-glpi-pass"
                  type="password"
                  autoComplete="new-password"
                  className="min-h-11"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  disabled={busy}
                  placeholder={
                    hasPasswordStored ? 'Dejar vacío para no cambiar' : 'Obligatoria la primera vez'
                  }
                />
                {hasPasswordStored ? (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input"
                      checked={clearPassword}
                      onChange={(e) => setClearPassword(e.target.checked)}
                      disabled={busy}
                    />
                    Quitar contraseña guardada
                  </label>
                ) : null}
                {mustSendPassword ? (
                  <p className="text-xs text-destructive">
                    Indicá una contraseña o quitá el requisito marcando quitar contraseña si aplica.
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {!loading && !glpiQ.isError ? (
            <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                className="min-h-11 gap-2"
                disabled={!canSave}
                onClick={() => patchM.mutate()}
              >
                {patchM.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 gap-2"
                disabled={!canTest}
                onClick={() => testM.mutate()}
                title={
                  formCompleteForInlineTest
                    ? 'Prueba con los valores del formulario'
                    : 'Prueba con la última configuración guardada'
                }
              >
                <PlugZap className="h-4 w-4" aria-hidden />
                {testM.isPending ? 'Probando…' : 'Probar conexión'}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {okDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onClick={() => setOkDialogOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sis-glpi-ok-title"
            className="max-w-sm rounded-xl border border-border bg-background p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="sis-glpi-ok-title" className="font-heading text-lg font-semibold">
              Conexión correcta
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              El servidor MySQL respondió; podés usar estos datos para Asignación de bienes.
            </p>
            <Button type="button" className="mt-4 min-h-11 w-full" onClick={() => setOkDialogOpen(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
