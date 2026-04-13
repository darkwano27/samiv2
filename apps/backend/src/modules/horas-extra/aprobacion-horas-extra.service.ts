import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createElement } from 'react';
import { and, desc, eq, gte, ilike, inArray, lte, or } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { SAMI_DB } from '@core/database/database.module';
import * as schema from '@core/database/schema';
import type { HeBoletaSubdivisionPair } from '@core/database/schema/he-boletas';
import { heBoletaHeaders, heBoletaLines } from '@core/database/schema/he-boletas';
import { workers } from '@core/database/schema/workers';
import { workforceSubdivisionRoleAssignees } from '@core/database/schema/workforce-subdivision-assignees';
import { PdfService, type PdfDocumentElement } from '@core/services/pdf.service';
import { getSoPdfLogoImageSrc, resolveSoPdfLogoPath } from '@core/pdf/pdf-assets';
import { UserSignatureService } from '@modules/auth/services/user-signature.service';
import { BoletaHePdfDocument } from './pdf/BoletaHePdfDocument';
import { REGISTRO_HE_MOTIVOS } from './registro-horas-extra.constants';
import { WorkforceOrgCatalogService } from './workforce-org-catalog.service';

function pairKey(divisionCode: string, subdivisionCode: string): string {
  return `${divisionCode.trim()}|${subdivisionCode.trim()}`;
}

/** Grilla WorkForce guardó históricamente `approver`; el resto del módulo usa `aprobador`. */
function isWorkforceApproverRole(dbRole: string): boolean {
  const r = dbRole.trim();
  return r === 'aprobador' || r === 'approver';
}

function parseHmToHours(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return 0;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h + min / 60;
}

/** Horas por día (mismo día; si fin < inicio se asume cruce de medianoche). */
function dailyHours(start: string, end: string): number {
  const a = parseHmToHours(start);
  let b = parseHmToHours(end);
  if (b < a) b += 24;
  return Math.max(0, b - a);
}

function lineTotalHours(days: number, timeStart: string, timeEnd: string): number {
  const d = Math.max(1, days);
  return Math.round(dailyHours(timeStart, timeEnd) * d * 10) / 10;
}

/** Una fila por boleta (cabecera). */
export type HeBandejaHeaderDto = {
  header_id: string;
  display_number: number;
  subdivision_codes: string[];
  subdivision_label: string;
  valid_from: string;
  valid_to: string;
  line_count: number;
  total_hours: number;
  motivo_code: string | null;
  status: string;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
};

export type HeBandejaHeadersPageDto = {
  items: HeBandejaHeaderDto[];
  total: number;
  page: number;
  page_size: number;
};

export type HeBoletaDetailLineDto = {
  id: string;
  pernr: string;
  worker_name: string | null;
  valid_from: string;
  valid_to: string;
  days: number;
  time_start: string;
  time_end: string;
  motivo_code: string | null;
  observaciones: string | null;
};

export type HeBoletaDetailDto = {
  header: {
    id: string;
    display_number: number;
    group_slug: string;
    division_code: string;
    subdivision_pairs: HeBoletaSubdivisionPair[];
    subdivision_label: string;
    valid_from: string;
    valid_to: string;
    time_start: string;
    time_end: string;
    motivo_code: string | null;
    status: string;
    created_by: string;
    created_by_name: string | null;
    created_at: string;
    approved_by: string | null;
    approved_by_name: string | null;
    approved_at: string | null;
  };
  lines: HeBoletaDetailLineDto[];
};

function effectiveBoletaStatus(raw: string): 'registrada' | 'aprobada' | 'anulada' {
  const s = raw.toLowerCase();
  if (s === 'anulada') return 'anulada';
  if (s === 'aprobada' || s === 'exportada') return 'aprobada';
  return 'registrada';
}

function headerMatchesStatusSet(dbStatus: string, wanted: Set<string>): boolean {
  if (wanted.size === 0) return true;
  return wanted.has(effectiveBoletaStatus(dbStatus));
}

function heMotivoLabel(code: string | null | undefined): string {
  const c = (code ?? '').trim();
  if (!c) return '—';
  const row = REGISTRO_HE_MOTIVOS.find((m) => m.code === c);
  return row?.label ?? c;
}

@Injectable()
export class AprobacionHorasExtraService {
  private readonly log = new Logger(AprobacionHorasExtraService.name);

  constructor(
    @Inject(SAMI_DB) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly orgCatalog: WorkforceOrgCatalogService,
    private readonly pdf: PdfService,
    private readonly userSignatures: UserSignatureService,
  ) {}

  private async allowedPairSetForBandeja(sap: string, fullOrgAccess: boolean): Promise<Set<string>> {
    if (fullOrgAccess) {
      const { groups } = await this.orgCatalog.listArisGroupsWithSubdivisions();
      const set = new Set<string>();
      for (const g of groups) {
        for (const s of g.subdivisions) {
          set.add(pairKey(s.division_code, s.subdivision_code));
        }
      }
      return set;
    }

    const assignRows = await this.db
      .select({
        divisionCode: workforceSubdivisionRoleAssignees.divisionCode,
        subdivisionCode: workforceSubdivisionRoleAssignees.subdivisionCode,
        role: workforceSubdivisionRoleAssignees.role,
      })
      .from(workforceSubdivisionRoleAssignees)
      .where(eq(workforceSubdivisionRoleAssignees.workerId, sap.trim()));

    const assignSet = new Set<string>();
    for (const r of assignRows) {
      const role = (r.role ?? '').trim();
      if (role === 'supervisor' || isWorkforceApproverRole(role)) {
        assignSet.add(pairKey(r.divisionCode, r.subdivisionCode));
      }
    }

    const { groups: catalogGroups } = await this.orgCatalog.listArisGroupsWithSubdivisions();
    const set = new Set<string>();
    for (const g of catalogGroups) {
      for (const s of g.subdivisions) {
        if (assignSet.has(pairKey(s.division_code, s.subdivision_code))) {
          set.add(pairKey(s.division_code, s.subdivision_code));
        }
      }
    }
    return set;
  }

  private headerVisibleForUser(
    pairs: HeBoletaSubdivisionPair[],
    allowed: Set<string>,
  ): boolean {
    return pairs.some((p) => allowed.has(pairKey(p.division_code, p.subdivision_code)));
  }

  private async isAprobadorOnHeader(sap: string, pairs: HeBoletaSubdivisionPair[]): Promise<boolean> {
    const rows = await this.db
      .select({
        divisionCode: workforceSubdivisionRoleAssignees.divisionCode,
        subdivisionCode: workforceSubdivisionRoleAssignees.subdivisionCode,
      })
      .from(workforceSubdivisionRoleAssignees)
      .where(
        and(
          eq(workforceSubdivisionRoleAssignees.workerId, sap.trim()),
          or(
            eq(workforceSubdivisionRoleAssignees.role, 'aprobador'),
            eq(workforceSubdivisionRoleAssignees.role, 'approver'),
          ),
        ),
      );
    const aprob = new Set(rows.map((r) => pairKey(r.divisionCode, r.subdivisionCode)));
    return pairs.some((p) => aprob.has(pairKey(p.division_code, p.subdivision_code)));
  }

  private async subdivisionNameMap(): Promise<Map<string, string>> {
    const { groups } = await this.orgCatalog.listArisGroupsWithSubdivisions();
    const m = new Map<string, string>();
    for (const g of groups) {
      for (const s of g.subdivisions) {
        m.set(pairKey(s.division_code, s.subdivision_code), s.name?.trim() || '');
      }
    }
    return m;
  }

  private formatSubdivisionLabel(
    pairs: HeBoletaSubdivisionPair[],
    nameMap: Map<string, string>,
  ): string {
    return pairs
      .map((p) => {
        const k = pairKey(p.division_code, p.subdivision_code);
        const n = nameMap.get(k);
        const code = p.subdivision_code.trim();
        return n ? `(${code}) ${n}` : `(${code})`;
      })
      .join(' · ');
  }

  /** Pares subdivisión visibles en bandeja (código + nombre ARIS) para filtros en UI. */
  async listSubdivisionOptionsForBandeja(
    sap: string,
    fullOrgAccess: boolean,
  ): Promise<{
    items: { division_code: string; subdivision_code: string; name: string }[];
  }> {
    const allowed = await this.allowedPairSetForBandeja(sap, fullOrgAccess);
    const { groups } = await this.orgCatalog.listArisGroupsWithSubdivisions();
    const items: { division_code: string; subdivision_code: string; name: string }[] = [];
    for (const g of groups) {
      for (const s of g.subdivisions) {
        const dc = s.division_code.trim();
        const sc = s.subdivision_code.trim();
        if (!allowed.has(pairKey(dc, sc))) continue;
        items.push({
          division_code: dc,
          subdivision_code: sc,
          name: (s.name ?? '').trim(),
        });
      }
    }
    items.sort((a, b) =>
      a.subdivision_code.localeCompare(b.subdivision_code, 'es', { numeric: true }),
    );
    return { items };
  }

  async listBandejaHeadersPage(
    sap: string,
    fullOrgAccess: boolean,
    opts: {
      dateFrom: string;
      dateTo: string;
      page: number;
      pageSize: number;
      workerQ?: string;
      subdivisionCodes?: string[];
      statusCodes?: string[];
      /** Coincidencia parcial sobre `display_number` (como filtro tipo Excel). */
      boletaQ?: string;
      /** Busca por nombre o código SAP del creador (`workers`). */
      creatorQ?: string;
    },
  ): Promise<HeBandejaHeadersPageDto> {
    const { dateFrom, dateTo, page, pageSize } = opts;
    const pageSafe = Math.max(1, page);
    const sizeSafe = Math.min(100, Math.max(1, pageSize));
    const allowed = await this.allowedPairSetForBandeja(sap, fullOrgAccess);
    const nameMap = await this.subdivisionNameMap();

    const statusWanted = new Set((opts.statusCodes ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean));
    const subWanted = new Set((opts.subdivisionCodes ?? []).map((s) => s.trim()).filter(Boolean));
    const boletaQ = (opts.boletaQ ?? '').trim();

    let creatorFilterIds: Set<string> | null = null;
    const cq = (opts.creatorQ ?? '').trim();
    if (cq.length > 0) {
      const safeC = cq.replace(/\\/g, '').replace(/%/g, '').replace(/_/g, '');
      const patternC = `%${safeC}%`;
      const creatorHits = await this.db
        .select({ id: workers.id })
        .from(workers)
        .where(or(ilike(workers.name, patternC), ilike(workers.id, patternC)));
      creatorFilterIds = new Set(creatorHits.map((r) => r.id.trim()));
      if (creatorFilterIds.size === 0) {
        return { items: [], total: 0, page: pageSafe, page_size: sizeSafe };
      }
    }

    let workerHeaderIds: Set<string> | null = null;
    const wq = (opts.workerQ ?? '').trim();
    if (wq.length > 0) {
      const safe = wq.replace(/\\/g, '').replace(/%/g, '').replace(/_/g, '');
      const pattern = `%${safe}%`;
      const hits = await this.db
        .selectDistinct({ headerId: heBoletaLines.headerId })
        .from(heBoletaLines)
        .where(
          or(ilike(heBoletaLines.pernr, pattern), ilike(heBoletaLines.workerName, pattern)),
        );
      workerHeaderIds = new Set(hits.map((h) => h.headerId));
      if (workerHeaderIds.size === 0) {
        return { items: [], total: 0, page: pageSafe, page_size: sizeSafe };
      }
    }

    const headerRows = await this.db
      .select({
        id: heBoletaHeaders.id,
        displayNumber: heBoletaHeaders.displayNumber,
        validFrom: heBoletaHeaders.validFrom,
        validTo: heBoletaHeaders.validTo,
        motivoCode: heBoletaHeaders.motivoCode,
        status: heBoletaHeaders.status,
        subdivisionPairs: heBoletaHeaders.subdivisionPairs,
        createdBy: heBoletaHeaders.createdBy,
        createdAt: heBoletaHeaders.createdAt,
      })
      .from(heBoletaHeaders)
      .where(and(lte(heBoletaHeaders.validFrom, dateTo), gte(heBoletaHeaders.validTo, dateFrom)))
      .orderBy(desc(heBoletaHeaders.createdAt), desc(heBoletaHeaders.displayNumber));

    const visible: (typeof headerRows)[0][] = [];

    for (const h of headerRows) {
      if (boletaQ.length > 0 && !String(h.displayNumber).includes(boletaQ)) continue;
      if (creatorFilterIds && !creatorFilterIds.has(h.createdBy.trim())) continue;
      if (workerHeaderIds && !workerHeaderIds.has(h.id)) continue;
      const pairs = (h.subdivisionPairs ?? []) as HeBoletaSubdivisionPair[];
      if (!this.headerVisibleForUser(pairs, allowed)) continue;
      if (subWanted.size > 0) {
        const codes = pairs.map((p) => p.subdivision_code.trim());
        if (!codes.some((c) => subWanted.has(c))) continue;
      }
      if (!headerMatchesStatusSet((h.status ?? '').trim(), statusWanted)) continue;
      visible.push(h);
    }

    const total = visible.length;
    const start = (pageSafe - 1) * sizeSafe;
    const pageSlice = visible.slice(start, start + sizeSafe);

    if (pageSlice.length === 0) {
      return { items: [], total, page: pageSafe, page_size: sizeSafe };
    }

    const ids = pageSlice.map((h) => h.id);
    const lineRows = await this.db
      .select({
        headerId: heBoletaLines.headerId,
        days: heBoletaLines.days,
        timeStart: heBoletaLines.timeStart,
        timeEnd: heBoletaLines.timeEnd,
      })
      .from(heBoletaLines)
      .where(inArray(heBoletaLines.headerId, ids));

    const agg = new Map<string, { count: number; hours: number }>();
    for (const lid of ids) {
      agg.set(lid, { count: 0, hours: 0 });
    }
    for (const ln of lineRows) {
      const cur = agg.get(ln.headerId);
      if (!cur) continue;
      cur.count += 1;
      cur.hours += lineTotalHours(ln.days, ln.timeStart, ln.timeEnd);
    }

    const creatorIds = [...new Set(pageSlice.map((h) => h.createdBy.trim()))];
    const creatorRows =
      creatorIds.length > 0
        ? await this.db
            .select({ id: workers.id, name: workers.name })
            .from(workers)
            .where(inArray(workers.id, creatorIds))
        : [];
    const creatorName = new Map(creatorRows.map((r) => [r.id, r.name]));

    const items: HeBandejaHeaderDto[] = pageSlice.map((h) => {
      const pairs = (h.subdivisionPairs ?? []) as HeBoletaSubdivisionPair[];
      const subdivisionCodes = [...new Set(pairs.map((p) => p.subdivision_code.trim()))];
      const a = agg.get(h.id) ?? { count: 0, hours: 0 };
      return {
        header_id: h.id,
        display_number: h.displayNumber,
        subdivision_codes: subdivisionCodes,
        subdivision_label: this.formatSubdivisionLabel(pairs, nameMap),
        valid_from: h.validFrom,
        valid_to: h.validTo,
        line_count: a.count,
        total_hours: Math.round(a.hours * 10) / 10,
        motivo_code: h.motivoCode?.trim() ?? null,
        status: (h.status ?? '').trim(),
        created_by: h.createdBy.trim(),
        created_by_name: creatorName.get(h.createdBy.trim()) ?? null,
        created_at: h.createdAt?.toISOString?.() ?? new Date().toISOString(),
      };
    });

    return { items, total, page: pageSafe, page_size: sizeSafe };
  }

  async getBoletaDetail(sap: string, fullOrgAccess: boolean, headerId: string): Promise<HeBoletaDetailDto> {
    const allowed = await this.allowedPairSetForBandeja(sap, fullOrgAccess);
    const nameMap = await this.subdivisionNameMap();

    const [h] = await this.db
      .select({
        id: heBoletaHeaders.id,
        displayNumber: heBoletaHeaders.displayNumber,
        groupSlug: heBoletaHeaders.groupSlug,
        divisionCode: heBoletaHeaders.divisionCode,
        subdivisionPairs: heBoletaHeaders.subdivisionPairs,
        validFrom: heBoletaHeaders.validFrom,
        validTo: heBoletaHeaders.validTo,
        timeStart: heBoletaHeaders.timeStart,
        timeEnd: heBoletaHeaders.timeEnd,
        motivoCode: heBoletaHeaders.motivoCode,
        status: heBoletaHeaders.status,
        createdBy: heBoletaHeaders.createdBy,
        createdAt: heBoletaHeaders.createdAt,
        approvedBy: heBoletaHeaders.approvedBy,
        approvedAt: heBoletaHeaders.approvedAt,
      })
      .from(heBoletaHeaders)
      .where(eq(heBoletaHeaders.id, headerId))
      .limit(1);

    if (!h) {
      throw new NotFoundException({ message: 'No encontramos la boleta.' });
    }

    const pairs = (h.subdivisionPairs ?? []) as HeBoletaSubdivisionPair[];
    if (!this.headerVisibleForUser(pairs, allowed)) {
      throw new ForbiddenException({ message: 'No tenés acceso a esta boleta.' });
    }

    const lineRows = await this.db
      .select({
        id: heBoletaLines.id,
        pernr: heBoletaLines.pernr,
        workerName: heBoletaLines.workerName,
        validFrom: heBoletaLines.validFrom,
        validTo: heBoletaLines.validTo,
        days: heBoletaLines.days,
        timeStart: heBoletaLines.timeStart,
        timeEnd: heBoletaLines.timeEnd,
        motivoCode: heBoletaLines.motivoCode,
        observaciones: heBoletaLines.observaciones,
      })
      .from(heBoletaLines)
      .where(eq(heBoletaLines.headerId, headerId));

    const [creator] = await this.db
      .select({ name: workers.name })
      .from(workers)
      .where(eq(workers.id, h.createdBy.trim()))
      .limit(1);

    const approverId = h.approvedBy?.trim() ?? '';
    const [approver] = approverId
      ? await this.db
          .select({ name: workers.name })
          .from(workers)
          .where(eq(workers.id, approverId))
          .limit(1)
      : [undefined];

    return {
      header: {
        id: h.id,
        display_number: h.displayNumber,
        group_slug: h.groupSlug.trim(),
        division_code: h.divisionCode.trim(),
        subdivision_pairs: pairs.map((p) => ({
          division_code: p.division_code.trim(),
          subdivision_code: p.subdivision_code.trim(),
        })),
        subdivision_label: this.formatSubdivisionLabel(pairs, nameMap),
        valid_from: h.validFrom,
        valid_to: h.validTo,
        time_start: h.timeStart,
        time_end: h.timeEnd,
        motivo_code: h.motivoCode?.trim() ?? null,
        status: (h.status ?? '').trim(),
        created_by: h.createdBy.trim(),
        created_by_name: creator?.name?.trim() ?? null,
        created_at: h.createdAt?.toISOString?.() ?? new Date().toISOString(),
        approved_by: approverId || null,
        approved_by_name: approver?.name?.trim() ?? null,
        approved_at: h.approvedAt?.toISOString?.() ?? null,
      },
      lines: lineRows.map((l) => ({
        id: l.id,
        pernr: l.pernr.trim(),
        worker_name: l.workerName?.trim() ?? null,
        valid_from: l.validFrom,
        valid_to: l.validTo,
        days: l.days,
        time_start: l.timeStart,
        time_end: l.timeEnd,
        motivo_code: l.motivoCode?.trim() ?? null,
        observaciones: l.observaciones?.trim() ?? null,
      })),
    };
  }

  async aprobarBoleta(sap: string, fullOrgAccess: boolean, headerId: string): Promise<{ ok: true }> {
    const allowed = await this.allowedPairSetForBandeja(sap, fullOrgAccess);

    const [h] = await this.db
      .select({
        id: heBoletaHeaders.id,
        subdivisionPairs: heBoletaHeaders.subdivisionPairs,
        status: heBoletaHeaders.status,
      })
      .from(heBoletaHeaders)
      .where(eq(heBoletaHeaders.id, headerId))
      .limit(1);

    if (!h) {
      throw new NotFoundException({ message: 'No encontramos la boleta.' });
    }

    const pairs = (h.subdivisionPairs ?? []) as HeBoletaSubdivisionPair[];
    if (!this.headerVisibleForUser(pairs, allowed)) {
      throw new ForbiddenException({ message: 'No tenés acceso a esta boleta.' });
    }

    if (effectiveBoletaStatus((h.status ?? '').trim()) !== 'registrada') {
      throw new BadRequestException({ message: 'Solo se pueden aprobar boletas en estado registrada.' });
    }

    if (!fullOrgAccess && !(await this.isAprobadorOnHeader(sap, pairs))) {
      throw new ForbiddenException({
        message: 'Solo un aprobador asignado a la subdivisión puede aprobar esta boleta.',
      });
    }

    await this.db
      .update(heBoletaHeaders)
      .set({
        status: 'aprobada',
        approvedBy: sap.trim(),
        approvedAt: new Date(),
      })
      .where(eq(heBoletaHeaders.id, headerId));

    return { ok: true as const };
  }

  /**
   * PDF solo para boletas aprobadas; firma del aprobador desde Mi firma (`worker_signatures`).
   */
  async renderApprovedBoletaPdf(
    sap: string,
    fullOrgAccess: boolean,
    headerId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const detail = await this.getBoletaDetail(sap, fullOrgAccess, headerId);
    if (effectiveBoletaStatus(detail.header.status) !== 'aprobada') {
      throw new BadRequestException({
        message: 'Solo se puede generar el PDF cuando la boleta está aprobada.',
      });
    }

    const approverSap = detail.header.approved_by?.trim() ?? '';
    let approverSig: string | null = null;
    let approverName = detail.header.approved_by_name ?? null;
    if (approverSap) {
      const sig = await this.userSignatures.getSignatureForPdf(approverSap);
      approverSig = sig.effective_data_url;
      if (!approverName) approverName = sig.display_name;
    }

    const logoPath = resolveSoPdfLogoPath();
    const logoSrc = getSoPdfLogoImageSrc();
    if (!logoSrc && logoPath) {
      this.log.warn(`Logo PDF presente en disco pero no cargable: ${logoPath}`);
    }

    const aprobadoEl = detail.header.approved_at
      ? new Date(detail.header.approved_at).toLocaleString('es-AR')
      : '—';

    const doc = createElement(BoletaHePdfDocument, {
      logoSrc,
      displayNumber: detail.header.display_number,
      subdivisionLabel: detail.header.subdivision_label,
      periodoCabecera: `${detail.header.valid_from} → ${detail.header.valid_to}`,
      horarioCabecera: `${detail.header.time_start} – ${detail.header.time_end}`,
      motivoCabecera: detail.header.motivo_code
        ? heMotivoLabel(detail.header.motivo_code)
        : null,
      registradoPor: detail.header.created_by_name ?? detail.header.created_by,
      registradoEl: new Date(detail.header.created_at).toLocaleString('es-AR'),
      aprobadoPor: approverName,
      aprobadoEl,
      lines: detail.lines.map((l) => ({
        pernr: l.pernr,
        nombre: l.worker_name ?? '—',
        desde: l.valid_from,
        hasta: l.valid_to,
        dias: l.days,
        horario: `${l.time_start}–${l.time_end}`,
        motivo: heMotivoLabel(l.motivo_code),
      })),
      approverSignatureSrc: approverSig,
    }) as PdfDocumentElement;

    const buffer = await this.pdf.renderToBuffer(doc);
    const filename = `boleta_he_${detail.header.display_number}.pdf`;
    return { buffer, filename };
  }

  async anularBoleta(sap: string, fullOrgAccess: boolean, headerId: string): Promise<{ ok: true }> {
    const allowed = await this.allowedPairSetForBandeja(sap, fullOrgAccess);

    const [h] = await this.db
      .select({
        id: heBoletaHeaders.id,
        subdivisionPairs: heBoletaHeaders.subdivisionPairs,
        status: heBoletaHeaders.status,
      })
      .from(heBoletaHeaders)
      .where(eq(heBoletaHeaders.id, headerId))
      .limit(1);

    if (!h) {
      throw new NotFoundException({ message: 'No encontramos la boleta.' });
    }

    const pairs = (h.subdivisionPairs ?? []) as HeBoletaSubdivisionPair[];
    if (!this.headerVisibleForUser(pairs, allowed)) {
      throw new ForbiddenException({ message: 'No tenés acceso a esta boleta.' });
    }

    if (effectiveBoletaStatus((h.status ?? '').trim()) !== 'registrada') {
      throw new BadRequestException({
        message: 'Solo se pueden anular boletas en estado registrada.',
      });
    }

    await this.db
      .update(heBoletaHeaders)
      .set({ status: 'anulada' })
      .where(eq(heBoletaHeaders.id, headerId));

    return { ok: true as const };
  }
}
