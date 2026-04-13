/**
 * Tab Correo — SMTP del módulo (persistido en servidor, contraseña cifrada).
 * API: GET/PATCH `/api/salud-ocupacional/module-settings/email-settings` (variant SO).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import {
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Mail,
  Send,
} from 'lucide-react';
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
  fetchAdminSystemEmailSettings,
  invalidateAdminSettingsQueries,
  patchAdminSystemEmailSettings,
  postAdminSystemEmailTest,
  readAdminServerMessage,
} from '@/modules/admin/repository/admin.api-repository';
import {
  invalidateSoModuleSettingsRelatedQueries,
  readSoModuleSettingsMessage,
  soFetchModuleEmailSettings,
  soPatchModuleEmailSettings,
  soPostModuleEmailTest,
} from '../repository/so-module-settings.api-repository';
import {
  invalidateSisModuleSettingsRelatedQueries,
  readSisModuleSettingsMessage,
  sisFetchModuleEmailSettings,
  sisPatchModuleEmailSettings,
  sisPostModuleEmailTest,
} from '@/modules/sistemas/ajustes/repository/sistemas-module-settings.api-repository';
import {
  invalidateWfModuleSettingsRelatedQueries,
  readWfModuleSettingsMessage,
  wfFetchModuleEmailSettings,
  wfPatchModuleEmailSettings,
  wfPostModuleEmailTest,
} from '@/modules/horas-extra/ajustes/repository/workforce-module-settings.api-repository';

const SMTP_USE_ENV_MARKER = '__USE_ENV__';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SoEmailSettingsTabVariant =
  | 'salud-ocupacional'
  | 'admin'
  | 'sistemas'
  | 'workforce';

type Props = {
  /** `admin` = SMTP de sistema (`module_slug=system`); los demás = SMTP del módulo indicado. */
  variant?: SoEmailSettingsTabVariant;
};

export function SoEmailSettingsTab({ variant = 'salud-ocupacional' }: Props) {
  const qc = useQueryClient();
  const isAdmin = variant === 'admin';
  const isSistemas = variant === 'sistemas';
  const isWorkforce = variant === 'workforce';
  const idp = isAdmin ? 'admin' : isSistemas ? 'sis' : isWorkforce ? 'wf' : 'so';

  const emailQ = useQuery({
    queryKey: isAdmin
      ? ['admin', 'settings', 'email']
      : isSistemas
        ? ['sistemas', 'module-settings', 'email-settings']
        : isWorkforce
          ? ['workforce', 'module-settings', 'email-settings']
          : ['so', 'module-settings', 'email-settings'],
    queryFn: isAdmin
      ? fetchAdminSystemEmailSettings
      : isSistemas
        ? sisFetchModuleEmailSettings
        : isWorkforce
          ? wfFetchModuleEmailSettings
          : soFetchModuleEmailSettings,
  });

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [mailSecure, setMailSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [clearPassword, setClearPassword] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [loadErrDetail, setLoadErrDetail] = useState<string | null>(null);
  /** Panel SMTP: abierto si no hay config guardada; colapsado si ya hay fila. */
  const [smtpPanelOpen, setSmtpPanelOpen] = useState(true);
  const [testSentDialogOpen, setTestSentDialogOpen] = useState(false);

  const smtpConfigured =
    !emailQ.isLoading && !emailQ.isError && emailQ.data != null;

  useEffect(() => {
    if (emailQ.isLoading) return;
    if (emailQ.isError) {
      setSmtpPanelOpen(true);
      return;
    }
    setSmtpPanelOpen(emailQ.data === null);
  }, [emailQ.isLoading, emailQ.isError, emailQ.data]);

  useEffect(() => {
    if (!emailQ.isError || !emailQ.error) {
      setLoadErrDetail(null);
      return;
    }
    const fn = isAdmin
      ? readAdminServerMessage
      : isSistemas
        ? readSisModuleSettingsMessage
        : isWorkforce
          ? readWfModuleSettingsMessage
          : readSoModuleSettingsMessage;
    void fn(emailQ.error).then((m) => setLoadErrDetail(m ?? null));
  }, [emailQ.isError, emailQ.error, isAdmin, isSistemas, isWorkforce]);

  useEffect(() => {
    if (!testSentDialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTestSentDialogOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [testSentDialogOpen]);

  useEffect(() => {
    if (emailQ.isLoading) return;
    const d = emailQ.data;
    if (d === null) {
      setSmtpHost('');
      setSmtpPort('587');
      setMailSecure(false);
      setSmtpUser('');
      setSmtpFrom('');
      setSmtpPass('');
      setClearPassword(false);
      return;
    }
    if (!d) return;
    setSmtpHost(d.smtp_host);
    setSmtpPort(String(d.smtp_port));
    setMailSecure(d.mail_secure);
    setSmtpUser(d.smtp_user ?? '');
    setSmtpFrom(d.smtp_from);
    setSmtpPass('');
    setClearPassword(false);
  }, [emailQ.data, emailQ.isLoading]);

  const hasPasswordStored = Boolean(emailQ.data?.smtp_pass_configured);
  /** Primera vez o sin contraseña guardada: hay que enviar una al guardar (salvo “quitar contraseña”). */
  const mustSendPassword =
    !clearPassword && !hasPasswordStored && !smtpPass.trim();

  const patchM = useMutation({
    mutationFn: () => {
      const port = Math.min(65535, Math.max(1, parseInt(smtpPort, 10) || 587));
      const body = {
        smtp_host: smtpHost.trim(),
        smtp_port: port,
        mail_secure: mailSecure,
        smtp_user: smtpUser.trim(),
        smtp_from: smtpFrom.trim(),
      };
      if (clearPassword) {
        if (isAdmin) {
          return patchAdminSystemEmailSettings({ ...body, smtp_pass: '' });
        }
        if (isSistemas) {
          return sisPatchModuleEmailSettings({ ...body, smtp_pass: '' });
        }
        if (isWorkforce) {
          return wfPatchModuleEmailSettings({ ...body, smtp_pass: '' });
        }
        return soPatchModuleEmailSettings({ ...body, smtp_pass: '' });
      }
      if (smtpPass.trim()) {
        if (isAdmin) {
          return patchAdminSystemEmailSettings({ ...body, smtp_pass: smtpPass.trim() });
        }
        if (isSistemas) {
          return sisPatchModuleEmailSettings({ ...body, smtp_pass: smtpPass.trim() });
        }
        if (isWorkforce) {
          return wfPatchModuleEmailSettings({ ...body, smtp_pass: smtpPass.trim() });
        }
        return soPatchModuleEmailSettings({ ...body, smtp_pass: smtpPass.trim() });
      }
      if (isAdmin) {
        return patchAdminSystemEmailSettings(body);
      }
      if (isSistemas) {
        return sisPatchModuleEmailSettings(body);
      }
      if (isWorkforce) {
        return wfPatchModuleEmailSettings(body);
      }
      return soPatchModuleEmailSettings(body);
    },
    onSuccess: async () => {
      setFormError(null);
      setSmtpPass('');
      setClearPassword(false);
      setSmtpPanelOpen(false);
      if (isAdmin) await invalidateAdminSettingsQueries(qc);
      else if (isSistemas) await invalidateSisModuleSettingsRelatedQueries(qc);
      else if (isWorkforce) await invalidateWfModuleSettingsRelatedQueries(qc);
      else await invalidateSoModuleSettingsRelatedQueries(qc);
    },
    onError: async (e) => {
      const readErr = isAdmin
        ? readAdminServerMessage
        : isSistemas
          ? readSisModuleSettingsMessage
          : isWorkforce
            ? readWfModuleSettingsMessage
            : readSoModuleSettingsMessage;
      setFormError(
        (await readErr(e)) ?? 'No se pudo guardar la configuración.',
      );
    },
  });

  const testM = useMutation({
    mutationFn: () => {
      if (isAdmin) return postAdminSystemEmailTest(testTo.trim());
      if (isSistemas) return sisPostModuleEmailTest(testTo.trim());
      if (isWorkforce) return wfPostModuleEmailTest(testTo.trim());
      return soPostModuleEmailTest(testTo.trim());
    },
    onSuccess: () => {
      setFormError(null);
      setTestSentDialogOpen(true);
    },
    onError: async (e) => {
      const readErr = isAdmin
        ? readAdminServerMessage
        : isSistemas
          ? readSisModuleSettingsMessage
          : isWorkforce
            ? readWfModuleSettingsMessage
            : readSoModuleSettingsMessage;
      setFormError(
        (await readErr(e)) ?? 'No se pudo enviar el correo de prueba.',
      );
    },
  });

  const loading = emailQ.isLoading;
  const busy = patchM.isPending || testM.isPending;

  const hostOk = Boolean(smtpHost.trim());
  const userOk = EMAIL_RE.test(smtpUser.trim());
  const fromOk = EMAIL_RE.test(smtpFrom.trim());
  const canSave =
    !busy &&
    hostOk &&
    userOk &&
    fromOk &&
    !mustSendPassword &&
    (smtpPass.trim() || hasPasswordStored || clearPassword);

  /** Prueba solo si ya hay fila guardada (GET devolvió objeto). */
  const configSaved = emailQ.data != null;
  const canSendTest =
    !busy &&
    configSaved &&
    EMAIL_RE.test(testTo.trim()) &&
    !emailQ.isError;

  const loadHttpStatus =
    emailQ.error instanceof HTTPError ? emailQ.error.response.status : null;

  const smtpSummary =
    smtpHost.trim() && smtpFrom.trim()
      ? `${smtpHost.trim()} · ${smtpFrom.trim()}`
      : null;

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="space-y-3 pb-2">
          <button
            type="button"
            className="flex w-full min-w-0 items-start gap-3 rounded-lg text-left outline-none ring-offset-background transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 sm:items-center"
            onClick={() => setSmtpPanelOpen((o) => !o)}
            aria-expanded={smtpPanelOpen}
            aria-controls={`${idp}-smtp-panel`}
          >
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:mt-0" aria-hidden />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base leading-snug">
                  {isAdmin
                    ? 'Correo del sistema (auth y avisos globales)'
                    : isSistemas
                      ? 'Correo del módulo Sistemas'
                      : isWorkforce
                        ? 'Correo del módulo WorkForce (horas extra)'
                        : 'Correo para envíos (PDF y avisos)'}
                </CardTitle>
                {loading ? (
                  <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Cargando…
                  </span>
                ) : emailQ.isError ? (
                  <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                    Error al cargar
                  </span>
                ) : smtpConfigured ? (
                  <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
                    Configurado
                  </span>
                ) : (
                  <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                    No configurado
                  </span>
                )}
              </div>
              {!smtpPanelOpen && smtpSummary && !emailQ.isError ? (
                <p className="truncate text-xs text-muted-foreground">{smtpSummary}</p>
              ) : null}
            </div>
            <ChevronDown
              className={cn(
                'h-5 w-5 shrink-0 text-muted-foreground transition-transform',
                smtpPanelOpen && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        </CardHeader>
        <CardContent
          id={`${idp}-smtp-panel`}
          className={cn('space-y-3', !smtpPanelOpen && 'hidden')}
        >
          <CardDescription className="text-xs leading-relaxed">
            {isAdmin
              ? 'Afecta recuperación de contraseña y correos que no pertenecen a un módulo concreto. La contraseña se guarda cifrada.'
              : isSistemas
                ? 'SMTP solo para el módulo Sistemas. La contraseña se guarda cifrada en el servidor; no se muestra nunca en claro.'
                : isWorkforce
                  ? 'SMTP solo para WorkForce (boletas y avisos del módulo). La contraseña se guarda cifrada; no se muestra en claro.'
                  : 'Configuración SMTP solo para este módulo. La contraseña se guarda cifrada en el servidor; no se muestra nunca en claro.'}
          </CardDescription>
          {formError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : emailQ.isError ? (
            <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">
                No se pudo cargar la configuración
                {loadHttpStatus ? ` (${loadHttpStatus})` : ''}.
              </p>
              {loadErrDetail ? (
                <p className="text-sm text-destructive/90">{loadErrDetail}</p>
              ) : null}
              {loadHttpStatus === 403 ? (
                <p className="text-xs text-muted-foreground">
                  {isWorkforce ? (
                    <>
                      Necesitás permisos de administración del módulo WorkForce (horas extra) para ver
                      o editar esta configuración.
                    </>
                  ) : (
                    <>
                      El backend solo permite esta pantalla a <strong>superadmin</strong> o a quien
                      tenga administración del módulo (rol en la app de gestión Salud Ocupacional). Con{' '}
                      <code className="rounded bg-muted px-1 font-mono text-[11px]">
                        VITE_RBAC_ENABLED=false
                      </code>{' '}
                      también se exige ese criterio para Ajustes SO.
                    </>
                  )}
                </p>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => void emailQ.refetch()}>
                Reintentar
              </Button>
            </div>
          ) : (
            <>
              {smtpHost === SMTP_USE_ENV_MARKER ? (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  El host <code className="font-mono">{SMTP_USE_ENV_MARKER}</code> indica que el envío
                  usa las variables <code className="font-mono">SMTP_*</code> del servidor hasta que
                  guardes un servidor SMTP real aquí.
                </p>
              ) : null}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${idp}-smtp-host`}>Servidor SMTP</Label>
                  <Input
                    id={`${idp}-smtp-host`}
                    autoComplete="off"
                    placeholder="smtp.office365.com"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    disabled={busy}
                    className="min-h-11"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`${idp}-smtp-port`}>Puerto</Label>
                    <Input
                      id={`${idp}-smtp-port`}
                      type="number"
                      min={1}
                      max={65535}
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      disabled={busy}
                      className="min-h-11"
                    />
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Conexión segura</legend>
                    <div className="flex flex-wrap gap-4 pt-1">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`${idp}-mail-secure`}
                          className="size-4 border-input"
                          checked={mailSecure}
                          onChange={() => setMailSecure(true)}
                          disabled={busy}
                        />
                        Sí (TLS directo, p. ej. 465)
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`${idp}-mail-secure`}
                          className="size-4 border-input"
                          checked={!mailSecure}
                          onChange={() => setMailSecure(false)}
                          disabled={busy}
                        />
                        No
                      </label>
                    </div>
                  </fieldset>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${idp}-smtp-user`}>Usuario</Label>
                  <Input
                    id={`${idp}-smtp-user`}
                    type="email"
                    autoComplete="off"
                    placeholder="helpdesk@empresa.com"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    disabled={busy}
                    className="min-h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${idp}-smtp-pass`}>Contraseña</Label>
                  <div className="relative">
                    <Input
                      id={`${idp}-smtp-pass`}
                      type={showPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder={
                        hasPasswordStored
                          ? 'Deja vacío para no cambiarla'
                          : 'Contraseña de aplicación o de buzón'
                      }
                      value={smtpPass}
                      onChange={(e) => {
                        setSmtpPass(e.target.value);
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
                          if (e.target.checked) setSmtpPass('');
                        }}
                        disabled={busy}
                      />
                      Quitar contraseña guardada
                    </label>
                  ) : null}              
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${idp}-smtp-from`}>Correo remitente (From)</Label>
                  <Input
                    id={`${idp}-smtp-from`}
                    type="email"
                    autoComplete="off"
                    placeholder="helpdesk@empresa.com"
                    value={smtpFrom}
                    onChange={(e) => setSmtpFrom(e.target.value)}
                    disabled={busy}
                    className="min-h-11"
                  />
                </div>
              </div>       

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="default"
                  className="min-h-11"
                  disabled={!canSave}
                  onClick={() => patchM.mutate()}
                >
                  {patchM.isPending ? 'Guardando…' : 'Guardar configuración'}
                </Button>
                {mustSendPassword ? (
                  <span className="self-center text-xs text-amber-700 dark:text-amber-400">
                    Ingresa la contraseña para el primer guardado.
                  </span>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Probar envío</CardTitle>
          <CardDescription>
            Envía un correo de prueba a una dirección que puedas revisar. La configuración tiene que
            estar guardada antes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor={`${idp}-email-test`}>Correo destino</Label>
            <Input
              id={`${idp}-email-test`}
              type="email"
              placeholder="tu@correo.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              disabled={busy}
              className="min-h-11"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-2"
            disabled={!canSendTest}
            title={
              !configSaved
                ? 'Guarda la configuración SMTP antes de probar'
                : undefined
            }
            onClick={() => testM.mutate()}
          >
            <Send className="h-4 w-4" aria-hidden />
            {testM.isPending ? 'Enviando…' : 'Enviar prueba'}
          </Button>
        </CardContent>
      </Card>

      {testSentDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${idp}-test-sent-title`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setTestSentDialogOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-4">
              <CheckCircle2
                className="h-10 w-10 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
              <div className="min-w-0 flex-1 space-y-3">
                <h2
                  id={`${idp}-test-sent-title`}
                  className="font-heading text-lg font-semibold tracking-tight"
                >
                  Correo de prueba enviado
                </h2>
                <p className="text-sm text-muted-foreground">
                  Se envió correctamente a{' '}
                  <span className="font-medium text-foreground">{testTo.trim()}</span>. Revisa la
                  bandeja de entrada (y spam si no aparece).
                </p>
                <Button
                  type="button"
                  className="mt-1 min-h-11"
                  onClick={() => setTestSentDialogOpen(false)}
                >
                  Aceptar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
