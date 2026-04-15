import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ModuleSmtpService } from '@core/mail/module-smtp.service';
import { PdfService, type PdfDocumentElement } from '@core/services/pdf.service';
import { RbacService } from '@modules/rbac/services/rbac.service';
import type { CachedPermissions } from '@modules/rbac/types/rbac-cache.types';
import { createElement } from 'react';
import { getSoPdfLogoImageSrc, resolveSoPdfLogoPath } from '@core/pdf/pdf-assets';
import { UserSignatureService } from '@modules/auth/services/user-signature.service';
import { ConsultationsRepository } from './consultations.repository';
import { ConsultationPdfDocument } from './pdf/ConsultationPdfDocument';
import type {
  CreateConsultationBody,
  CreateDiagnosisBody,
  CreateMedicineBody,
  HistorialQuery,
  MyConsultationsQuery,
  UpdateDiagnosisBody,
  UpdateMedicineBody,
} from './dto/consultations.dto';

const SO_MODULE_SLUG = 'salud-ocupacional';

/** Fecha/hora para el cuerpo del correo (ej.: "miércoles, 1 de abril de 2026 — 11:02 a. m."). */
function formatAttentionForEmail(d: Date | string): string {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  const dateStr = x.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = x.toLocaleTimeString('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr} — ${timeStr}`;
}

const SO_EMAIL_SUBJECT = 'ATENCION MEDICA DE TOPICO';

function soDischargeLabelEs(condition: string): string {
  const m: Record<string, string> = {
    observacion: 'En observación',
    recuperado: 'Recuperado',
    derivado: 'Derivado al hospital',
  };
  return m[condition] ?? condition;
}

function buildSoTopicNotificationBody(parts: {
  patientName: string;
  reason: string;
  attentionLabel: string;
  dischargeLabel: string;
  preamble?: string;
}): string {
  const lines: string[] = [];
  if (parts.preamble) {
    lines.push(parts.preamble, '');
  }
  lines.push(
    `Nombre del Paciente: ${parts.patientName}`,
    `Motivo: ${parts.reason}`,
    `Fecha y hora: ${parts.attentionLabel}`,
    `Condición al alta: ${parts.dischargeLabel}`,
  );
  return lines.join('\n');
}

@Injectable()
export class ConsultationsService {
  private readonly logger = new Logger(ConsultationsService.name);

  constructor(
    private readonly repo: ConsultationsRepository,
    private readonly rbac: RbacService,
    private readonly pdf: PdfService,
    private readonly moduleSmtp: ModuleSmtpService,
    private readonly userSignatures: UserSignatureService,
  ) {}

  sapSearch(q: string) {
    if (!this.repo.hasSap()) {
      throw new ServiceUnavailableException({
        message: 'SAP staging no disponible',
      });
    }
    return this.repo.searchSapWorkers(q);
  }

  listDiagnoses() {
    return this.repo.listActiveDiagnoses();
  }

  listMedicines() {
    return this.repo.listActiveMedicines();
  }

  searchMedicines(q: string) {
    return this.repo.searchMedicinesByName(q);
  }

  async createDiagnosis(body: CreateDiagnosisBody) {
    const dup = await this.repo.findDiagnosisName(body.name);
    if (dup) {
      throw new ConflictException({
        message: 'Ya existe un diagnóstico con ese nombre',
      });
    }
    const row = await this.repo.insertDiagnosis({
      name: body.name,
      code: body.code,
    });
    if (!row) {
      throw new ConflictException({ message: 'No se pudo crear el diagnóstico' });
    }
    return row;
  }

  async createMedicine(body: CreateMedicineBody) {
    const row = await this.repo.insertMedicine({
      name: body.name,
      presentation: body.presentation,
      concentration: body.concentration,
      administrationRoute: body.administrationRoute,
      inventoryUnit: body.inventoryUnit,
      expirationDate: body.expirationDate,
    });
    if (!row) {
      throw new ConflictException({ message: 'No se pudo crear el medicamento' });
    }
    return row;
  }

  async createConsultation(
    body: CreateConsultationBody,
    createdBy: string,
    workerDisplayName: string,
  ) {
    if (!this.repo.hasSap()) {
      throw new ServiceUnavailableException({
        message: 'SAP staging no disponible',
      });
    }

    const patient = await this.repo.getSapWorkerByPernr(body.patientCod);
    if (!patient) {
      throw new UnprocessableEntityException({
        message: 'Paciente no encontrado o inactivo en SAP',
      });
    }

    await this.repo.ensureWorkerRow(createdBy, workerDisplayName);

    const dxRows = await this.repo.findDiagnosesByIds(body.diagnosisIds);
    if (dxRows.length !== body.diagnosisIds.length) {
      throw new UnprocessableEntityException({
        message: 'Uno o más diagnósticos no existen o están inactivos',
      });
    }

    const rxInput = body.prescriptions ?? [];
    const medIds = [...new Set(rxInput.map((p) => p.medicineId))];
    const medRows = await this.repo.findMedicinesByIds(medIds);
    const medById = new Map(medRows.map((m) => [m.id, m]));
    if (medRows.length !== medIds.length) {
      throw new UnprocessableEntityException({
        message: 'Uno o más medicamentos no existen o están inactivos',
      });
    }

    const snapshots = rxInput.map((p) => {
      const m = medById.get(p.medicineId)!;
      return {
        medicineId: p.medicineId,
        medicineName: m.name,
        presentation: m.presentation,
        concentration: m.concentration,
        administrationRoute: m.administrationRoute,
        frequency: p.frequency,
        duration: p.duration,
        quantity: p.quantity,
        instructions: p.instructions,
      };
    });

    const sapSnapshot = await this.repo.getSapPatientSnapshot(body.patientCod);
    const out = await this.repo.createConsultationBundle(
      body,
      createdBy,
      snapshots,
      sapSnapshot,
    );
    void this.sendConsultationNotificationEmails(
      out.id,
      body,
      workerDisplayName,
    );
    return { id: out.id, correlative: out.correlative, success: true as const };
  }

  /**
   * 1) Correo solo al paciente con PDF (diagnóstico y ficha completa).
   * 2) Si hay jefatura: correo al responsable, copia al paciente, sin PDF (mismo asunto y cuerpo estructurado).
   * No bloquea la respuesta HTTP; fallos solo se registran en log.
   */
  private async sendConsultationNotificationEmails(
    consultationId: string,
    body: CreateConsultationBody,
    professionalDisplayName: string,
  ): Promise<void> {
    const patientTo = body.emailTo?.trim() || body.patientEmail?.trim();
    const supervisorTo = body.supervisorEmail?.trim();

    const detail = await this.repo.getConsultationDetail(consultationId);
    if (!detail) {
      this.logger.warn(
        `Consulta ${consultationId} no encontrada al generar correos de notificación`,
      );
      return;
    }

    const patientName = detail.patientName.trim();
    const attentionLabel = formatAttentionForEmail(detail.attentionDate);
    const reasonText = (detail.reason ?? '').trim() || '—';
    const dischargeLabel = soDischargeLabelEs(detail.dischargeCondition);

    const structuredPatient = buildSoTopicNotificationBody({
      patientName,
      reason: reasonText,
      attentionLabel,
      dischargeLabel,
      preamble:
        'Adjuntamos la ficha de atención médica de tópico en PDF (diagnóstico y detalle de la consulta).',
    });

    const structuredSupervisor = buildSoTopicNotificationBody({
      patientName,
      reason: reasonText,
      attentionLabel,
      dischargeLabel,
      preamble: 'Le informamos el siguiente registro de atención en tópico.',
    });

    let professionalSignatureDataUrl: string | undefined;
    let professionalDisplayNameForPdf = professionalDisplayName.trim();
    try {
      const prof = await this.userSignatures.getSignatureForPdf(
        detail.createdBy,
      );
      professionalSignatureDataUrl = prof.effective_data_url ?? undefined;
      const wn = (prof.display_name ?? '').trim();
      if (wn) {
        professionalDisplayNameForPdf = wn;
      }
    } catch {
      professionalSignatureDataUrl = undefined;
    }
    if (this.repo.hasSap()) {
      try {
        const sapW = await this.repo.getSapWorkerByPernr(detail.createdBy.trim());
        const sapName = (sapW?.name ?? '').trim();
        if (sapName && sapName !== '—') {
          professionalDisplayNameForPdf = sapName;
        }
      } catch {
        /* SAP no disponible */
      }
    }

    if (patientTo) {
      try {
        const logoPath = resolveSoPdfLogoPath();
        const logoSrc = getSoPdfLogoImageSrc();
        if (!logoSrc && logoPath) {
          this.logger.warn(
            `Logo SO presente en disco pero no se pudo cargar para el PDF: ${logoPath}`,
          );
        }
        const creatorSap = detail.createdBy.trim();
        const hasSupervisorProfile =
          await this.rbac.workerHasSaludOcupacionalSupervisorModuleProfile(
            creatorSap,
          );
        const attentionRowVariant = hasSupervisorProfile
          ? 'alerta_medica'
          : 'attended_by';

        const buffer = await this.pdf.renderToBuffer(
          createElement(ConsultationPdfDocument, {
            detail,
            professionalDisplayName: professionalDisplayNameForPdf,
            professionalSignatureDataUrl,
            logoSrc,
            attentionRowVariant,
          }) as PdfDocumentElement,
        );
        const codSafe = detail.patientCod.trim().replace(/[^\w.-]+/g, '_');
        const filename = `${codSafe}_CONSULTA_SO_${detail.correlative}.pdf`;

        await this.moduleSmtp.sendMailForModule(SO_MODULE_SLUG, {
          to: patientTo,
          subject: SO_EMAIL_SUBJECT,
          text: structuredPatient,
          attachments: [
            { filename, content: buffer, contentType: 'application/pdf' },
          ],
        });
        this.logger.log(
          `PDF de consulta ${consultationId} enviado solo al paciente: ${patientTo}`,
        );
      } catch (e) {
        this.logger.error(
          `No se pudo enviar PDF al paciente (${consultationId}): ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } else {
      this.logger.log(
        `Sin correo del paciente; no se genera ni envía PDF (${consultationId})`,
      );
    }

    if (supervisorTo) {
      if (supervisorTo.toLowerCase() === patientTo?.toLowerCase()) {
        this.logger.warn(
          `Correo de jefatura igual al del paciente; se omite notificación a jefatura (${consultationId})`,
        );
        return;
      }
      const ccPatient =
        patientTo && patientTo.toLowerCase() !== supervisorTo.toLowerCase()
          ? patientTo
          : undefined;
      try {
        await this.moduleSmtp.sendMailForModule(SO_MODULE_SLUG, {
          to: supervisorTo,
          cc: ccPatient,
          subject: SO_EMAIL_SUBJECT,
          text: structuredSupervisor,
        });
        this.logger.log(
          `Notificación sin PDF de consulta ${consultationId} a jefatura ${supervisorTo}` +
            (ccPatient ? ` (CC paciente ${ccPatient})` : ''),
        );
      } catch (e) {
        this.logger.error(
          `No se pudo enviar correo a jefatura (${consultationId}): ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  async getHistorial(query: HistorialQuery) {
    const total = await this.repo.countHistorial(query);
    const data = await this.repo.listHistorial(query);
    const totalPages = Math.max(1, Math.ceil(total / query.limit));
    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  getHistorialFilterMeta() {
    return this.repo.listHistorialFilterMeta();
  }

  async buildHistorialCsv(filters: HistorialQuery): Promise<string> {
    const rows = await this.repo.listHistorialExportForCsv(filters);
    const header = [
      'cod_trabajador',
      'apellidos_y_nombre',
      'desc_establ',
      'desc_div',
      'desc_subdiv',
      'desc_pos',
      'fech_nacim',
      'nro_documento',
      'cent_costo',
      'fech_ingreso',
      'fecha_atencion',
      'atendido_por',
      'diagnostico',
      'farmaco',
      'cantidad',
      'condicion',
    ];
    const esc = (v: string | number | null | undefined) => {
      const s = v == null ? '' : String(v);
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [header.join(',')];
    for (const r of rows) {
      const c = r.row;
      const fecha = new Date(c.attentionDate).toISOString().slice(0, 10);
      lines.push(
        [
          esc(c.patientCod),
          esc(c.patientName),
          esc(c.patientEstabl ?? ''),
          esc(c.patientDivision ?? ''),
          esc(c.patientSubdivision ?? ''),
          esc(c.patientPosition ?? ''),
          esc(c.patientBirthDate ?? ''),
          esc(c.patientDocumentId ?? ''),
          esc(c.patientCostCenter ?? ''),
          esc(c.patientHireDate ?? ''),
          esc(fecha),
          esc(r.attendedByLabel),
          esc(r.diagnosisText),
          esc(r.medicineName),
          esc(r.quantity ?? ''),
          esc(r.dischargeLabel),
        ].join(','),
      );
    }
    return `\uFEFF${lines.join('\r\n')}`;
  }

  async getMyConsultations(sapCode: string, query: MyConsultationsQuery) {
    const { page, limit, dateFrom, dateTo } = query;
    const q = { dateFrom, dateTo };
    const total = await this.repo.countMyConsultations(sapCode, q);
    const data = await this.repo.listMyConsultations(sapCode, page, limit, q);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      data,
      pagination: { page, limit, total, totalPages },
    };
  }

  listInventarioDiagnosesCatalog() {
    return this.repo.listAllDiagnosesCatalog();
  }

  listInventarioMedicinesCatalog() {
    return this.repo.listAllMedicinesCatalog();
  }

  async updateDiagnosisCatalog(id: string, body: UpdateDiagnosisBody) {
    const existing = await this.repo.getDiagnosisById(id);
    if (!existing) {
      throw new NotFoundException({ message: 'Diagnóstico no encontrado' });
    }
    if (body.name !== undefined) {
      const dup = await this.repo.findDiagnosisNameExcluding(body.name, id);
      if (dup) {
        throw new ConflictException({
          message: 'Ya existe un diagnóstico con ese nombre',
        });
      }
    }
    const row = await this.repo.updateDiagnosisById(id, body);
    if (!row) {
      throw new NotFoundException({ message: 'Diagnóstico no encontrado' });
    }
    return row;
  }

  async updateMedicineCatalog(id: string, body: UpdateMedicineBody) {
    const existing = await this.repo.getMedicineById(id);
    if (!existing) {
      throw new NotFoundException({ message: 'Medicamento no encontrado' });
    }
    const row = await this.repo.updateMedicineById(id, body);
    if (!row) {
      throw new NotFoundException({ message: 'Medicamento no encontrado' });
    }
    return row;
  }

  async assertCanReadConsultation(
    cached: CachedPermissions,
    sapCode: string,
    patientCod: string,
  ): Promise<void> {
    if (cached.isSuperadmin) return;

    const canHistorial = await this.rbac.canAccess(
      cached,
      'historial-medico',
      'listar',
      'read',
    );
    const canRegistro = await this.rbac.canAccess(
      cached,
      'registro-consulta',
      'operar',
      'read',
    );
    if (canHistorial || canRegistro) return;

    const canMine = await this.rbac.canAccess(
      cached,
      'mis-consultas',
      'listar',
      'read',
    );
    if (canMine && patientCod.trim() === sapCode.trim()) return;

    throw new ForbiddenException({ message: 'Sin permiso para ver esta consulta' });
  }

  async getConsultationDetail(
    id: string,
    cached: CachedPermissions,
    sapCode: string,
  ) {
    const row = await this.repo.getConsultationDetail(id);
    if (!row) {
      throw new NotFoundException({ message: 'Consulta no encontrada' });
    }
    await this.assertCanReadConsultation(cached, sapCode, row.patientCod);
    return row;
  }
}
