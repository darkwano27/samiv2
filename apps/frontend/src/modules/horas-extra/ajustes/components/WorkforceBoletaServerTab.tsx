import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Network } from 'lucide-react';
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
import {
  invalidateWfModuleSettingsRelatedQueries,
  readWfModuleSettingsMessage,
  wfFetchBoletaExportSettings,
  wfPatchBoletaExportSettings,
  wfPostBoletaExportTest,
  type WfBoletaExportPatch,
} from '../repository/workforce-module-settings.api-repository';

export function WorkforceBoletaServerTab() {
  const qc = useQueryClient();
  const settingsQ = useQuery({
    queryKey: ['workforce', 'module-settings', 'boleta-export-settings'],
    queryFn: wfFetchBoletaExportSettings,
  });

  const [protocol, setProtocol] = useState<'sftp' | 'smb'>('sftp');
  const [host, setHost] = useState('');
  const [portStr, setPortStr] = useState('22');
  const [remotePath, setRemotePath] = useState('/');
  const [shareName, setShareName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [clearPassword, setClearPassword] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (settingsQ.isLoading) return;
    const d = settingsQ.data;
    if (d == null) {
      setProtocol('sftp');
      setHost('');
      setPortStr('22');
      setRemotePath('/');
      setShareName('');
      setUsername('');
      setPassword('');
      setClearPassword(false);
      return;
    }
    setProtocol(d.protocol);
    setHost(d.host);
    setPortStr(String(d.port));
    setRemotePath(d.remote_path || '/');
    setShareName(d.share_name ?? '');
    setUsername(d.username ?? '');
    setPassword('');
    setClearPassword(false);
  }, [settingsQ.data, settingsQ.isLoading]);

  const hasPasswordStored = Boolean(settingsQ.data?.password_configured);
  const mustSendPassword =
    !clearPassword && !hasPasswordStored && !password.trim() && Boolean(settingsQ.data);

  const patchM = useMutation({
    mutationFn: (body: WfBoletaExportPatch) => wfPatchBoletaExportSettings(body),
    onSuccess: async () => {
      setFormError(null);
      setPassword('');
      setClearPassword(false);
      setTestResult(null);
      await invalidateWfModuleSettingsRelatedQueries(qc);
    },
    onError: async (e) => {
      setFormError((await readWfModuleSettingsMessage(e)) ?? 'No se pudo guardar.');
    },
  });

  const testM = useMutation({
    mutationFn: wfPostBoletaExportTest,
    onSuccess: (r) => {
      setFormError(null);
      if (r.ok) {
        setTestResult(`Conexión TCP al host y puerto OK (${r.ms} ms). No valida usuario ni subida de archivos.`);
      } else {
        setTestResult(r.message);
      }
    },
    onError: async (e) => {
      setTestResult(null);
      setFormError((await readWfModuleSettingsMessage(e)) ?? 'No se pudo ejecutar la prueba.');
    },
  });

  const busy = patchM.isPending || testM.isPending;
  const port = Math.min(65535, Math.max(1, parseInt(portStr, 10) || (protocol === 'smb' ? 445 : 22)));

  const hostOk = Boolean(host.trim());
  const pathOk = Boolean(remotePath.trim());
  const smbShareOk = protocol !== 'smb' || Boolean(shareName.trim());

  const canSave =
    !busy &&
    hostOk &&
    pathOk &&
    smbShareOk &&
    !mustSendPassword &&
    (password.trim() || hasPasswordStored || clearPassword || !settingsQ.data);

  /** Primera vez (sin fila): permitir guardar sin contraseña si el usuario deja vacío — backend acepta null password */
  const canSaveFirstTime =
    !settingsQ.data && !busy && hostOk && pathOk && smbShareOk && protocol;

  const effectiveCanSave = settingsQ.data ? canSave : canSaveFirstTime;

  function buildPatch(): WfBoletaExportPatch {
    const body: WfBoletaExportPatch = {
      protocol,
      host: host.trim(),
      port,
      remote_path: remotePath.trim() || '/',
      share_name: protocol === 'smb' ? (shareName.trim() || null) : null,
      username: username.trim() || null,
    };
    if (clearPassword) {
      body.password = '';
    } else if (password.trim()) {
      body.password = password.trim();
    }
    return body;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Destino de archivos CSV (boletas)</CardTitle>
          <CardDescription>
            Configuración para depositar los CSV generados vía SFTP o SMB. La contraseña se guarda
            cifrada. La prueba de conexión solo comprueba que el puerto responde en TCP (no inicia
            sesión SFTP/SMB).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          {testResult ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {testResult}
            </p>
          ) : null}

          {settingsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : settingsQ.isError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">No se pudo cargar la configuración.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void settingsQ.refetch()}>
                Reintentar
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="wf-boleta-protocol">Protocolo</Label>
                  <select
                    id="wf-boleta-protocol"
                    className="flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={protocol}
                    disabled={busy}
                    onChange={(e) => {
                      const p = e.target.value === 'smb' ? 'smb' : 'sftp';
                      setProtocol(p);
                      setPortStr(p === 'smb' ? '445' : '22');
                    }}
                  >
                    <option value="sftp">SFTP (SSH, típ. puerto 22)</option>
                    <option value="smb">SMB / carpeta de red (típ. puerto 445)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wf-boleta-host">Servidor (host o IP)</Label>
                  <Input
                    id="wf-boleta-host"
                    autoComplete="off"
                    placeholder="servidor.empresa.local"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    disabled={busy}
                    className="min-h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wf-boleta-port">Puerto</Label>
                  <Input
                    id="wf-boleta-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={portStr}
                    onChange={(e) => setPortStr(e.target.value)}
                    disabled={busy}
                    className="min-h-11"
                  />
                </div>

                {protocol === 'smb' ? (
                  <div className="space-y-2">
                    <Label htmlFor="wf-boleta-share">Nombre del recurso compartido (share)</Label>
                    <Input
                      id="wf-boleta-share"
                      autoComplete="off"
                      placeholder="BoletasHE"
                      value={shareName}
                      onChange={(e) => setShareName(e.target.value)}
                      disabled={busy}
                      className="min-h-11"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="wf-boleta-path">Ruta remota (carpeta destino)</Label>
                  <Input
                    id="wf-boleta-path"
                    autoComplete="off"
                    placeholder="/entrada/boletas o subcarpeta en el share"
                    value={remotePath}
                    onChange={(e) => setRemotePath(e.target.value)}
                    disabled={busy}
                    className="min-h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wf-boleta-user">Usuario (opcional)</Label>
                  <Input
                    id="wf-boleta-user"
                    autoComplete="off"
                    placeholder="dominio\\usuario o usuario SFTP"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={busy}
                    className="min-h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wf-boleta-pass">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="wf-boleta-pass"
                      type={showPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder={
                        hasPasswordStored
                          ? 'Vacío = no cambiar'
                          : 'Contraseña para el servicio (se guarda cifrada)'
                      }
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setClearPassword(false);
                      }}
                      disabled={busy || clearPassword}
                      className="min-h-11 pr-11"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => setShowPass((v) => !v)}
                      disabled={busy || clearPassword}
                      aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {hasPasswordStored ? (
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border-input"
                        checked={clearPassword}
                        onChange={(e) => {
                          setClearPassword(e.target.checked);
                          if (e.target.checked) setPassword('');
                        }}
                        disabled={busy}
                      />
                      Quitar contraseña guardada
                    </label>
                  ) : null}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Requiere <code className="rounded bg-muted px-1 font-mono text-[11px]">SETTINGS_ENCRYPTION_KEY</code>{' '}
                en el servidor para guardar credenciales.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!effectiveCanSave}
                  className="min-h-11"
                  onClick={() => patchM.mutate(buildPatch())}
                >
                  {patchM.isPending ? 'Guardando…' : 'Guardar'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 gap-2"
                  disabled={busy || !hostOk || !settingsQ.data}
                  title={!settingsQ.data ? 'Guardá al menos una vez para fijar host y puerto' : undefined}
                  onClick={() => {
                    setTestResult(null);
                    testM.mutate();
                  }}
                >
                  <Network className="h-4 w-4" aria-hidden />
                  {testM.isPending ? 'Probando…' : 'Probar alcance TCP'}
                </Button>
              </div>
              {mustSendPassword ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Ingresá la contraseña o marcá «Quitar contraseña guardada» para poder guardar cambios.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
