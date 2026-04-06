/**
 * Tab SharePoint / Microsoft Graph — credenciales de aplicación y rutas (cifrado en servidor).
 * API: GET/PATCH/POST test `sistemas/module-settings/sharepoint-settings*`.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Cloud, PlugZap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  invalidateSisModuleSettingsRelatedQueries,
  readSisModuleSettingsMessage,
  sisFetchSharepointSettings,
  sisPatchSharepointSettings,
  sisPostSharepointConnectionTest,
} from '../repository/sistemas-module-settings.api-repository';

export function SistemasSharepointSettingsTab() {
  const qc = useQueryClient();
  const spQ = useQuery({
    queryKey: ['sistemas', 'module-settings', 'sharepoint-settings'],
    queryFn: sisFetchSharepointSettings,
  });

  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [sitePath, setSitePath] = useState('');
  const [driveName, setDriveName] = useState('');
  const [parentFolder, setParentFolder] = useState('');
  const [publicHost, setPublicHost] = useState('');
  const [clearSecret, setClearSecret] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadErrDetail, setLoadErrDetail] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [okTestOpen, setOkTestOpen] = useState(false);

  const hasSecretStored = Boolean(spQ.data?.client_secret_configured);
  const mustSendSecret = !clearSecret && !hasSecretStored && !clientSecret.trim();

  useEffect(() => {
    if (spQ.isLoading) return;
    if (spQ.isError) {
      setPanelOpen(true);
      return;
    }
    setPanelOpen(spQ.data === null);
  }, [spQ.isLoading, spQ.isError, spQ.data]);

  useEffect(() => {
    if (!spQ.isError || !spQ.error) {
      setLoadErrDetail(null);
      return;
    }
    void readSisModuleSettingsMessage(spQ.error).then((m) => setLoadErrDetail(m ?? null));
  }, [spQ.isError, spQ.error]);

  useEffect(() => {
    if (spQ.isLoading) return;
    const d = spQ.data;
    if (!d) {
      setTenantId('');
      setClientId('');
      setClientSecret('');
      setSitePath('');
      setDriveName('');
      setParentFolder('');
      setPublicHost('');
      setClearSecret(false);
      return;
    }
    setTenantId(d.tenant_id ?? '');
    setClientId(d.client_id ?? '');
    setClientSecret('');
    setSitePath(d.site_path ?? '');
    setDriveName(d.drive_name ?? '');
    setParentFolder(d.parent_folder ?? '');
    setPublicHost(d.public_host ?? '');
    setClearSecret(false);
  }, [spQ.data, spQ.isLoading]);

  const patchM = useMutation({
    mutationFn: () => {
      const body: Parameters<typeof sisPatchSharepointSettings>[0] = {
        tenant_id: tenantId.trim(),
        client_id: clientId.trim(),
        site_path: sitePath.trim(),
        drive_name: driveName.trim(),
        parent_folder: parentFolder.trim(),
        public_host: publicHost.trim(),
      };
      if (clearSecret) {
        body.client_secret = '';
      } else if (clientSecret.trim()) {
        body.client_secret = clientSecret.trim();
      }
      return sisPatchSharepointSettings(body);
    },
    onSuccess: async () => {
      setFormError(null);
      setClientSecret('');
      setClearSecret(false);
      setPanelOpen(false);
      await invalidateSisModuleSettingsRelatedQueries(qc);
      await qc.invalidateQueries({ queryKey: ['sistemas', 'module-settings', 'sharepoint-settings'] });
    },
    onError: async (e) => {
      setFormError((await readSisModuleSettingsMessage(e)) ?? 'No se pudo guardar la configuración.');
    },
  });

  const testM = useMutation({
    mutationFn: sisPostSharepointConnectionTest,
    onSuccess: () => {
      setFormError(null);
      setOkTestOpen(true);
      window.setTimeout(() => setOkTestOpen(false), 4000);
    },
    onError: async (e) => {
      setFormError(
        (await readSisModuleSettingsMessage(e)) ??
          'No se pudo validar la conexión con Microsoft Graph.',
      );
    },
  });

  const summaryParts: string[] = [];
  if (spQ.data?.tenant_id?.trim()) summaryParts.push(`Tenant …${spQ.data.tenant_id.trim().slice(-6)}`);
  if (spQ.data?.client_id?.trim()) summaryParts.push('App registrada');
  const summaryText =
    summaryParts.length > 0 ? summaryParts.join(' · ') : 'Sin datos guardados en base (solo .env si aplica)';

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border/80">
        <button
          type="button"
          className="flex w-full items-start gap-3 rounded-xl p-4 text-left transition-colors hover:bg-muted/40"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300">
            <Cloud className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Carpeta compartida (SharePoint)</CardTitle>
              {spQ.data &&
              spQ.data.tenant_id?.trim() &&
              spQ.data.client_id?.trim() &&
              spQ.data.client_secret_configured ? (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                  Configurado
                </span>
              ) : (
                <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-100">
                  Revisar
                </span>
              )}
            </div>
            <CardDescription className="mt-1">{summaryText}</CardDescription>
          </div>
          <ChevronDown
            className={cn(
              'mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform',
              panelOpen ? 'rotate-180' : '',
            )}
            aria-hidden
          />
        </button>
        {panelOpen ? (
          <CardContent className="space-y-4 border-t border-border/60 px-4 pb-4 pt-4">
            {spQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : null}
            {spQ.isError ? (
              <p className="text-sm text-destructive">
                No se pudo cargar la configuración.
                {loadErrDetail ? ` ${loadErrDetail}` : ''}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Credenciales de aplicación (Azure AD) para subir PDFs del acta. Los campos vacíos en base
              de datos se completan con las variables <code className="text-xs">O365_*</code> del
              servidor si existen.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sis-sp-tenant">Tenant ID (directorio Azure)</Label>
                <Input
                  id="sis-sp-tenant"
                  className="min-h-11 font-mono text-sm"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sis-sp-client">Client ID (aplicación)</Label>
                <Input
                  id="sis-sp-client"
                  className="min-h-11 font-mono text-sm"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="ID de la app registrada en Azure"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sis-sp-secret">Client secret</Label>
                <Input
                  id="sis-sp-secret"
                  type="password"
                  className="min-h-11 font-mono text-sm"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={hasSecretStored ? 'Dejar vacío para mantener el actual' : 'Valor del secreto'}
                  autoComplete="new-password"
                />
                {hasSecretStored ? (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={clearSecret}
                      onChange={(e) => setClearSecret(e.target.checked)}
                    />
                    Quitar el secreto guardado (se usará solo el del servidor si está definido)
                  </label>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sis-sp-site">Ruta del sitio (Graph)</Label>
                <Input
                  id="sis-sp-site"
                  className="min-h-11 text-sm"
                  value={sitePath}
                  onChange={(e) => setSitePath(e.target.value)}
                  placeholder="dominio.sharepoint.com:/ruta/al/sitio"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sis-sp-drive">Biblioteca de documentos</Label>
                <Input
                  id="sis-sp-drive"
                  className="min-h-11 text-sm"
                  value={driveName}
                  onChange={(e) => setDriveName(e.target.value)}
                  placeholder="Documentos"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sis-sp-host">URL pública (enlaces)</Label>
                <Input
                  id="sis-sp-host"
                  className="min-h-11 text-sm"
                  value={publicHost}
                  onChange={(e) => setPublicHost(e.target.value)}
                  placeholder="https://tu-tenant.sharepoint.com"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sis-sp-parent">Carpeta base dentro de la biblioteca</Label>
                <Input
                  id="sis-sp-parent"
                  className="min-h-11 text-sm"
                  value={parentFolder}
                  onChange={(e) => setParentFolder(e.target.value)}
                  placeholder="Repositorio Apps/Asignacion de Bienes"
                  autoComplete="off"
                />
              </div>
            </div>
            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
            {okTestOpen ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Conexión correcta: se obtuvo token de Microsoft Graph.
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                className="min-h-11"
                disabled={patchM.isPending || mustSendSecret}
                onClick={() => patchM.mutate()}
              >
                {patchM.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 gap-2"
                disabled={testM.isPending}
                onClick={() => testM.mutate()}
              >
                <PlugZap className="h-4 w-4" aria-hidden />
                {testM.isPending ? 'Probando…' : 'Probar conexión'}
              </Button>
            </div>
            {mustSendSecret ? (
              <p className="text-xs text-muted-foreground">
                Indicá el client secret la primera vez, o configurá solo las variables{' '}
                <code className="text-[11px]">O365_CLIENT_SECRET</code> en el servidor.
              </p>
            ) : null}
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
