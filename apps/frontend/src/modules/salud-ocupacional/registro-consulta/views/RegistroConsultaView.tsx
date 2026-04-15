import {
  Briefcase,
  Building2,
  ClipboardList,
  Hash,
  Mail,
  PenLine,
  Pill,
  Plus,
  Search,
  User,
  X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AddDiagnosisDialog } from '../components/AddDiagnosisDialog';
import { AddMedicineDialog } from '../components/AddMedicineDialog';
import { AddPrescriptionModal } from '../components/AddPrescriptionModal';
import { ConsultationSavedModal } from '../components/ConsultationSavedModal';
import { SignaturePadModal } from '../components/SignaturePadModal';
import { useSoDiagnoses } from '../hooks/use-so-diagnoses';
import { useSoSapSearch } from '../hooks/use-so-sap-search';
import { useSoCreateConsultation } from '../hooks/use-so-registro-mutations';
import { readApiMessage } from '../repository/so-consultations.api-repository';
import type {
  SoDischargeCondition,
  SoPrescriptionDraft,
  SoSapWorker,
} from '../types/so-consultation.types';
import { createLocalKey } from '../utils/local-key';
import { ccWorkerEmail, primaryWorkerEmail } from '../utils/so-worker-email';

function defaultLocalDatetime(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

function localInputToIso(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString();
  }
  return d.toISOString();
}

/** Texto del buscador SAP al elegir una persona (nombre completo + código). */
function formatSapWorkerPickLabel(w: SoSapWorker): string {
  return `${w.name} (${w.cod})`;
}

function initialsFromName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0]!.slice(0, 1).toUpperCase();
  return (p[0]!.slice(0, 1) + p[p.length - 1]!.slice(0, 1)).toUpperCase();
}

const DISCHARGE_OPTIONS: { value: SoDischargeCondition; label: string }[] = [
  { value: 'observacion', label: 'OBSERVACION' },
  { value: 'recuperado', label: 'RECUPERADO' },
  { value: 'derivado', label: 'DERIVADO' },
];

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

const textareaClass =
  'flex min-h-[88px] w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm leading-snug shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[120px] sm:py-2';

/** Espaciado vertical entre bloques dentro de cada card (apretado en móvil). */
const soCardBody = 'space-y-2 pt-2 sm:space-y-3 sm:pt-3';

/** Borde de contenedores: token global `--border` (mismo patrón en todas las secciones). */
const soSectionCardClass = 'border border-border shadow-sm';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide leading-tight text-primary">
      {children}
    </p>
  );
}

export function RegistroConsultaView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<SoSapWorker | null>(null);

  const [referrerQuery, setReferrerQuery] = useState('');
  const [selectedReferrer, setSelectedReferrer] = useState<SoSapWorker | null>(null);

  const [supervisorQuery, setSupervisorQuery] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState<SoSapWorker | null>(
    null,
  );

  const [patientEmail, setPatientEmail] = useState('');

  const [diagnosisIds, setDiagnosisIds] = useState<string[]>([]);
  const [dxSearch, setDxSearch] = useState('');
  const [dxListOpen, setDxListOpen] = useState(false);
  const [dxDialogOpen, setDxDialogOpen] = useState(false);
  const [medCatalogOpen, setMedCatalogOpen] = useState(false);
  const [rxModalOpen, setRxModalOpen] = useState(false);

  const [attentionLocal, setAttentionLocal] = useState(() => defaultLocalDatetime());
  const [reason, setReason] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [discharge, setDischarge] = useState<SoDischargeCondition | ''>('');

  const [prescriptions, setPrescriptions] = useState<SoPrescriptionDraft[]>([]);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [sigModalOpen, setSigModalOpen] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [savedModal, setSavedModal] = useState<{
    id: string;
    email: string;
    correlative: number;
    supervisorEmail?: string;
  } | null>(null);

  const sapPatientQ = useSoSapSearch(patientQuery);
  const sapReferrerQ = useSoSapSearch(selectedReferrer ? '' : referrerQuery);
  const sapSupervisorQ = useSoSapSearch(selectedSupervisor ? '' : supervisorQuery);
  const dxQ = useSoDiagnoses();
  const createConsultation = useSoCreateConsultation();

  const diagnoses = dxQ.data ?? [];

  /** Evita que el autocompletado de diagnóstico (debajo del formulario) quede por encima de modales. */
  useEffect(() => {
    if (
      rxModalOpen ||
      dxDialogOpen ||
      medCatalogOpen ||
      sigModalOpen ||
      savedModal != null
    ) {
      setDxListOpen(false);
    }
  }, [rxModalOpen, dxDialogOpen, medCatalogOpen, sigModalOpen, savedModal]);

  function selectPatient(p: SoSapWorker) {
    setSelectedPatient(p);
    setPatientEmail(primaryWorkerEmail(p));
    setPatientQuery('');
  }

  function selectReferrer(p: SoSapWorker) {
    setSelectedReferrer(p);
    setReferrerQuery('');
  }

  function selectSupervisor(w: SoSapWorker) {
    setSelectedSupervisor(w);
    setSupervisorQuery('');
  }

  function addDiagnosis(id: string) {
    if (diagnosisIds.includes(id)) return;
    setDiagnosisIds((prev) => [...prev, id]);
    setDxSearch('');
    setDxListOpen(false);
  }

  const filteredDiagnoses = useMemo(() => {
    const q = dxSearch.trim().toLowerCase();
    return diagnoses
      .filter((d) => !diagnosisIds.includes(d.id))
      .filter((d) => {
        if (!q) return true;
        const hay = `${d.name} ${d.code ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 80);
  }, [diagnoses, diagnosisIds, dxSearch]);

  function removeDiagnosis(id: string) {
    setDiagnosisIds((prev) => prev.filter((x) => x !== id));
  }

  function addPrescriptionRow(row: Omit<SoPrescriptionDraft, 'localKey'>) {
    setPrescriptions((prev) => [
      ...prev,
      { ...row, localKey: createLocalKey() },
    ]);
  }

  const canSubmit = useMemo(() => {
    return (
      selectedPatient &&
      diagnosisIds.length >= 1 &&
      reason.trim().length >= 1 &&
      discharge !== '' &&
      !createConsultation.isPending
    );
  }, [
    selectedPatient,
    diagnosisIds.length,
    reason,
    discharge,
    createConsultation.isPending,
  ]);

  function resetFormFields() {
    setSelectedPatient(null);
    setPatientQuery('');
    setReferrerQuery('');
    setSelectedReferrer(null);
    setSupervisorQuery('');
    setSelectedSupervisor(null);
    setPatientEmail('');
    setDiagnosisIds([]);
    setAttentionLocal(defaultLocalDatetime());
    setReason('');
    setReceiptNumber('');
    setDischarge('');
    setPrescriptions([]);
    setSignatureData(null);
    setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!selectedPatient) {
      setFormError('Seleccioná un paciente.');
      return;
    }
    if (diagnosisIds.length < 1) {
      setFormError('Agregá al menos un diagnóstico.');
      return;
    }
    if (!reason.trim()) {
      setFormError('El motivo de atención es obligatorio.');
      return;
    }
    if (!discharge) {
      setFormError('Seleccioná la condición al alta.');
      return;
    }

    if (selectedSupervisor) {
      const supEm =
        ccWorkerEmail(selectedSupervisor) ||
        primaryWorkerEmail(selectedSupervisor);
      if (!supEm?.trim()) {
        setFormError(
          'La persona de jefatura elegida no tiene correo registrado. Elegí otra o quitá la selección.',
        );
        return;
      }
    }

    const emailTo = patientEmail.trim() || undefined;
    const supervisorEmailRaw = selectedSupervisor
      ? ccWorkerEmail(selectedSupervisor) ||
        primaryWorkerEmail(selectedSupervisor)
      : undefined;
    const supervisorEmail = supervisorEmailRaw?.trim() || undefined;
    const supervisorName = selectedSupervisor?.name;

    const savedEmailSnap =
      patientEmail.trim() || primaryWorkerEmail(selectedPatient);

    const payload = {
      patientCod: selectedPatient.cod,
      patientName: selectedPatient.name,
      patientPosition: selectedPatient.position ?? undefined,
      patientDivision: selectedPatient.division ?? undefined,
      patientSubdivision: selectedPatient.subdivision ?? undefined,
      patientAge: selectedPatient.age ?? undefined,
      patientEmail: emailTo,
      referredByCod: selectedReferrer?.cod,
      referredByName: selectedReferrer?.name,
      attentionDate: localInputToIso(attentionLocal),
      reason: reason.trim(),
      dischargeCondition: discharge,
      receiptNumber: receiptNumber.trim() || undefined,
      emailTo,
      supervisorEmail,
      supervisorName,
      signatureData: signatureData ?? undefined,
      diagnosisIds,
      prescriptions: prescriptions.map((p) => ({
        medicineId: p.medicineId,
        quantity: p.quantity,
        frequency: p.frequency,
        duration: p.duration,
        instructions: p.instructions,
      })),
    };

    createConsultation.mutate(payload, {
      onSuccess: (res) => {
        setSavedModal({
          id: res.id,
          email: savedEmailSnap,
          correlative: res.correlative,
          supervisorEmail: supervisorEmail || undefined,
        });
        resetFormFields();
      },
      onError: async (e) => {
        setFormError(
          (await readApiMessage(e)) ?? 'No se pudo guardar la consulta.',
        );
      },
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-3 pb-16 sm:gap-4 sm:p-4 sm:pb-24">
      <div className="leading-tight">
        <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          Registro de consulta
        </h1>
        <p className="mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">
          Salud ocupacional — completá los bloques y guardá al final.
        </p>
      </div>

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      {/* —— Buscador por código (paciente) —— */}
      <section className="space-y-1.5 sm:space-y-2">
        <SectionTitle>Buscador por código (paciente)</SectionTitle>
        <Card size="sm" className={soSectionCardClass}>
          <CardContent className={soCardBody}>
            <div className="space-y-1 sm:space-y-1.5">
              <Label htmlFor="so-patient-search">Paciente</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="so-patient-search"
                  className="pl-9"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Código, nombre, documento, división…"
                  autoComplete="off"
                />
              </div>
            </div>
            {sapPatientQ.isFetching ? (
              <p className="text-xs text-muted-foreground">Buscando…</p>
            ) : null}
            {sapPatientQ.isError ? (
              <p className="text-sm text-destructive">
                No se pudo completar la búsqueda. Reintentá más tarde.
              </p>
            ) : null}
            {patientQuery.trim().length >= 1 &&
            sapPatientQ.data &&
            sapPatientQ.data.length > 0 ? (
              <ul
                className="max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-sm"
                role="listbox"
              >
                {sapPatientQ.data.map((w) => (
                  <li key={w.cod}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 sm:gap-2.5 sm:py-2.5"
                      onClick={() => selectPatient(w)}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground sm:h-10 sm:w-10 sm:text-sm">
                        {initialsFromName(w.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold uppercase leading-tight text-foreground">
                          {w.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {w.cod}
                          {w.sede ? ` · ${w.sede}` : ''}
                          {w.jobTitle ?? w.position
                            ? ` · ${w.jobTitle ?? w.position}`
                            : ''}
                          {w.division ? ` · ${w.division}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">
                        {w.age != null ? `${w.age} años` : '—'}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {selectedPatient ? (
              <div className="rounded-xl border border-border bg-background p-3 shadow-sm sm:p-4">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary sm:h-12 sm:w-12 sm:text-base">
                    {initialsFromName(selectedPatient.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold uppercase leading-snug">
                      {selectedPatient.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedPatient.cod}
                      {selectedPatient.sede ? ` · ${selectedPatient.sede}` : ''}
                      {selectedPatient.jobTitle ?? selectedPatient.position
                        ? ` · ${selectedPatient.jobTitle ?? selectedPatient.position}`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Quitar paciente"
                    onClick={() => {
                      setSelectedPatient(null);
                      setPatientEmail('');
                    }}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-3 grid gap-1.5 sm:mt-4 sm:grid-cols-2 sm:gap-2">
                  <Tile icon={Hash} label="Código" value={selectedPatient.cod} />
                  <Tile
                    icon={Building2}
                    label="Sede"
                    value={selectedPatient.sede ?? '—'}
                  />
                  <Tile
                    icon={Briefcase}
                    label="Cargo"
                    value={
                      selectedPatient.jobTitle ?? selectedPatient.position ?? '—'
                    }
                  />
                  <Tile
                    icon={Building2}
                    label="División"
                    value={selectedPatient.division ?? '—'}
                  />
                  <Tile
                    icon={Building2}
                    label="Subdivisión"
                    value={selectedPatient.subdivision ?? '—'}
                  />
                  <Tile
                    icon={User}
                    label="Edad"
                    value={
                      selectedPatient.age != null
                        ? `${selectedPatient.age} años`
                        : '—'
                    }
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* —— Registro de Atención —— */}
      <section className="space-y-1.5 sm:space-y-2">
        <div className="flex items-center gap-1 sm:gap-1.5">
          <ClipboardList
            className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5"
            aria-hidden
          />
          <SectionTitle>Registro de Atención</SectionTitle>
        </div>
        <Card size="sm" className={soSectionCardClass}>
          <CardContent className={soCardBody}>
            <div className="space-y-1 sm:space-y-1.5">
              <Label htmlFor="so-attention">Fecha de atención</Label>
              <Input
                id="so-attention"
                type="datetime-local"
                value={attentionLocal}
                onChange={(e) => setAttentionLocal(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <Label htmlFor="so-reason">Motivo de atención *</Label>
              <textarea
                id="so-reason"
                className={textareaClass}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describí los síntomas o motivo de la visita…"
                rows={4}
              />
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <Label htmlFor="so-referrer-search">Derivado por</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="so-referrer-search"
                  className={cn(
                    'pl-9',
                    selectedReferrer ? 'pr-10' : undefined,
                  )}
                  value={
                    selectedReferrer
                      ? formatSapWorkerPickLabel(selectedReferrer)
                      : referrerQuery
                  }
                  onChange={(e) => {
                    if (selectedReferrer) setSelectedReferrer(null);
                    setReferrerQuery(e.target.value);
                  }}
                  placeholder="Buscar por nombre, apellidos o código…"
                  autoComplete="off"
                />
                {selectedReferrer ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md hover:bg-muted/80"
                    aria-label="Quitar derivado por"
                    onClick={() => {
                      setSelectedReferrer(null);
                      setReferrerQuery('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {!selectedReferrer &&
              referrerQuery.trim().length >= 1 &&
              sapReferrerQ.data &&
              sapReferrerQ.data.length > 0 ? (
                <ul className="max-h-36 overflow-y-auto rounded-md border border-border">
                  {sapReferrerQ.data.map((w) => (
                    <li key={w.cod}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
                        onClick={() => selectReferrer(w)}
                      >
                        {w.name}{' '}
                        <span className="text-muted-foreground">({w.cod})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <Label htmlFor="so-receipt">N° boleta generada</Label>
              <Input
                id="so-receipt"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="Ingresar número de boleta"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <Label htmlFor="so-discharge">Condición al alta *</Label>
              <select
                id="so-discharge"
                className={selectClass}
                value={discharge}
                onChange={(e) =>
                  setDischarge((e.target.value || '') as SoDischargeCondition | '')
                }
              >
                <option value="">Seleccionar condición…</option>
                {DISCHARGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* —— Diagnóstico —— */}
      <section className="space-y-1.5 sm:space-y-2">
        <SectionTitle>Diagnóstico</SectionTitle>
        <Card size="sm" className={cn(soSectionCardClass, 'overflow-visible')}>
          <CardContent className={soCardBody}>
            <div className="space-y-1 sm:space-y-1.5">
              <Label htmlFor="so-dx-search">Buscar diagnóstico</Label>
              <div className="flex flex-row items-stretch gap-2 sm:items-center">
                <div className="relative z-30 min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="so-dx-search"
                    className="h-10 pl-9"
                    value={dxSearch}
                    onChange={(e) => {
                      setDxSearch(e.target.value);
                      setDxListOpen(true);
                    }}
                    onFocus={() => setDxListOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setDxListOpen(false), 150);
                    }}
                    placeholder="Escribí nombre o código…"
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={dxListOpen}
                    aria-autocomplete="list"
                  />
                  {dxListOpen && filteredDiagnoses.length > 0 ? (
                    <ul
                      className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg"
                      role="listbox"
                    >
                      {filteredDiagnoses.map((d) => (
                        <li key={d.id} role="option">
                          <button
                            type="button"
                            className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted/60"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addDiagnosis(d.id)}
                          >
                            <span className="font-medium">{d.name}</span>
                            {d.code ? (
                              <span className="ml-1 text-muted-foreground">
                                ({d.code})
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {dxListOpen &&
                  dxSearch.trim().length > 0 &&
                  filteredDiagnoses.length === 0 ? (
                    <p className="absolute left-0 right-0 top-full z-40 mt-1 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-lg">
                      Sin coincidencias.
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 border-border text-primary"
                  title="Agregar diagnóstico al catálogo"
                  onClick={() => setDxDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>              
            </div>
            {diagnosisIds.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {diagnosisIds.map((id) => {
                  const d = diagnoses.find((x) => x.id === id);
                  if (!d) return null;
                  return (
                    <li
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-sm"
                    >
                      <span>{d.name}</span>
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-primary/15"
                        aria-label={`Quitar ${d.name}`}
                        onClick={() => removeDiagnosis(id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* —— Receta médica —— */}
      <section className="space-y-1.5 sm:space-y-2">
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Pill
            className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5"
            aria-hidden
          />
          <SectionTitle>Receta médica (Fármacos)</SectionTitle>
        </div>
        <Card size="sm" className={soSectionCardClass}>
          <CardContent className={soCardBody}>
            {prescriptions.length === 0 ? (
              <p className="text-xs text-muted-foreground sm:text-sm">
                Sin fármacos en la receta.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 font-medium">Descripción artículo</th>
                      <th className="px-3 py-2 font-medium">Dosis</th>
                      <th className="px-3 py-2 font-medium">Presentación</th>
                      <th className="px-3 py-2 font-medium">Vía administración</th>
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((p) => (
                      <tr key={p.localKey} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 align-top">
                          <span className="font-medium">{p.medicineLabel}</span>
                          <p className="text-xs text-muted-foreground">
                            Cant. {p.quantity}
                            {p.frequency ? ` · ${p.frequency}` : ''}
                          </p>
                        </td>
                        <td className="px-3 py-2 align-top text-muted-foreground">
                          {p.concentration}
                        </td>
                        <td className="px-3 py-2 align-top">{p.presentation}</td>
                        <td className="px-3 py-2 align-top text-muted-foreground">
                          {p.administrationRoute}
                        </td>
                        <td className="px-2 py-2 align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setPrescriptions((prev) =>
                                prev.filter((x) => x.localKey !== p.localKey),
                              )
                            }
                            aria-label="Quitar fármaco"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button
              type="button"
              onClick={() => setRxModalOpen(true)}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-2.5 text-sm font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/5 sm:py-3.5',
              )}
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              Agregar fármaco
            </button>
          </CardContent>
        </Card>
      </section>

      {/* —— Remitir a correos —— */}
      <section className="space-y-1.5 sm:space-y-2">
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Mail
            className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5"
            aria-hidden
          />
          <SectionTitle>Remitir a correos</SectionTitle>
        </div>
        <Card size="sm" className={soSectionCardClass}>
          <CardContent className={soCardBody}>
            <div className="space-y-1 sm:space-y-1.5">
              <Label htmlFor="so-patient-email">Correo del paciente</Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="so-patient-email"
                  type="email"
                  className="pl-9"
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  placeholder="Correo corporativo o personal"
                  autoComplete="off"
                />
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                Por defecto: corporativo si existe; si no, personal (cuenta local).
              </p>
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <Label htmlFor="so-supervisor-search">Jefatura</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="so-supervisor-search"
                  className={cn(
                    'pl-9',
                    selectedSupervisor ? 'pr-10' : undefined,
                  )}
                  value={
                    selectedSupervisor
                      ? formatSapWorkerPickLabel(selectedSupervisor)
                      : supervisorQuery
                  }
                  onChange={(e) => {
                    if (selectedSupervisor) setSelectedSupervisor(null);
                    setSupervisorQuery(e.target.value);
                  }}
                  placeholder="Nombre, apellidos o código del responsable…"
                  autoComplete="off"
                />
                {selectedSupervisor ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md hover:bg-muted/80"
                    aria-label="Quitar jefatura"
                    onClick={() => {
                      setSelectedSupervisor(null);
                      setSupervisorQuery('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                Opcional. Si eliges jefatura, el sistema envía el PDF solo al paciente y un
                segundo correo al responsable (sin PDF), con copia al paciente.
              </p>
              {!selectedSupervisor &&
              supervisorQuery.trim().length >= 1 &&
              sapSupervisorQ.data &&
              sapSupervisorQ.data.length > 0 ? (
                <ul className="max-h-36 overflow-y-auto rounded-md border border-border">
                  {sapSupervisorQ.data.map((w) => (
                    <li key={w.cod}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
                        onClick={() => selectSupervisor(w)}
                      >
                        {w.name}{' '}
                        <span className="text-muted-foreground">
                          ({ccWorkerEmail(w) ?? primaryWorkerEmail(w) ?? 'sin correo'})
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* —— Firma digital —— */}
      <section className="space-y-1.5 sm:space-y-2">
        <SectionTitle>Firma digital</SectionTitle>
        <Card size="sm" className={soSectionCardClass}>
          <CardContent className="pt-2 sm:pt-4">
            <button
              type="button"
              onClick={() => setSigModalOpen(true)}
              className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border py-4 text-center transition-colors hover:border-primary/40 hover:bg-muted/20 sm:gap-1.5 sm:py-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 sm:h-11 sm:w-11">
                <PenLine className="h-5 w-5" aria-hidden />
              </div>
              <span className="px-2 text-sm font-medium text-sky-800 dark:text-sky-200">
                {signatureData
                  ? 'Firma lista. Tocá para cambiar.'
                  : 'Sin firma. Tocá para abrir el panel de firmas.'}
              </span>
            </button>
          </CardContent>
        </Card>
      </section>

      <Card size="sm" className={soSectionCardClass}>
        <CardFooter className="flex flex-col gap-1.5 border-t py-2.5 sm:flex-row sm:justify-end sm:gap-2 sm:py-3">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              resetFormFields();
              setSavedModal(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="w-full gap-2 bg-primary sm:w-auto"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            <ClipboardList className="h-4 w-4" aria-hidden />
            {createConsultation.isPending ? 'Guardando…' : 'Guardar consulta'}
          </Button>
        </CardFooter>
      </Card>

      <AddDiagnosisDialog
        open={dxDialogOpen}
        onClose={() => setDxDialogOpen(false)}
        onCreated={(id) => addDiagnosis(id)}
      />
      <AddMedicineDialog
        open={medCatalogOpen}
        onClose={() => setMedCatalogOpen(false)}
        onCreated={() => {
          setMedCatalogOpen(false);
          void queryClient.invalidateQueries({
            queryKey: ['so', 'registro', 'medicines-search'],
          });
        }}
      />
      <AddPrescriptionModal
        open={rxModalOpen}
        onClose={() => setRxModalOpen(false)}
        onAdd={(row) => addPrescriptionRow(row)}
        onOpenCatalog={() => setMedCatalogOpen(true)}
      />
      <SignaturePadModal
        open={sigModalOpen}
        onClose={() => setSigModalOpen(false)}
        onConfirm={(png) => setSignatureData(png)}
        initialDataUrl={signatureData}
        title="Firma del paciente"
        subtitle="Firmá en el recuadro con el mouse o el dedo."
      />
      <ConsultationSavedModal
        open={savedModal != null}
        correlative={savedModal?.correlative ?? 0}
        patientEmail={savedModal?.email ?? ''}
        supervisorEmail={savedModal?.supervisorEmail}
        onClose={() => setSavedModal(null)}
        onNewConsultation={() => {
          setSavedModal(null);
          resetFormFields();
        }}
        onGoHistorial={() => {
          setSavedModal(null);
          void navigate({ to: '/salud-ocupacional/historial-medico' });
        }}
      />
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-border/80 bg-muted/20 px-2.5 py-1 sm:gap-2 sm:px-3 sm:py-1.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" aria-hidden />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
