import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { SAMI_DB, SAP_DB } from '@core/database/database.module';
import * as schema from '@core/database/schema';
import { heBoletaHeaders, heBoletaLines } from '@core/database/schema/he-boletas';
import { workforceSubdivisionRoleAssignees } from '@core/database/schema/workforce-subdivision-assignees';
import { eiisTrabajadores } from '@core/database/schema-sap/eiis-trabajadores';
import * as sapSchema from '@core/database/schema-sap';
import { REGISTRO_HE_MOTIVOS } from './registro-horas-extra.constants';
import type { CreateHeBoletaBody } from './dto/registro-horas-extra.dto';
import { WorkforceOrgCatalogService } from './workforce-org-catalog.service';

function isTrabajadorActivoStat(stat2: string | null | undefined): boolean {
  return Number(String(stat2 ?? '').trim()) === 3;
}

function stat2ActivoCondition() {
  return or(
    sql`trim(${eiisTrabajadores.stat2}) = '3'`,
    sql`trim(${eiisTrabajadores.stat2}) = '03'`,
  );
}

function compareStagingRows(
  a: typeof eiisTrabajadores.$inferSelect,
  b: typeof eiisTrabajadores.$inferSelect,
): number {
  const ba = (a.begda ?? '').trim();
  const bb = (b.begda ?? '').trim();
  if (ba !== bb) return ba > bb ? 1 : -1;
  const ia = a.idRegistro ?? 0;
  const ib = b.idRegistro ?? 0;
  return ia - ib;
}

function formatStagingWorkerName(
  vorna: string | null | undefined,
  nachn: string | null | undefined,
): string {
  return `${(vorna ?? '').trim()} ${(nachn ?? '').trim()}`.trim();
}

function pairKey(divisionCode: string, subdivisionCode: string): string {
  return `${divisionCode.trim()}|${subdivisionCode.trim()}`;
}

/** Orden numérico por código de subdivisión (2080 antes que 9040, etc.). */
function sortSubdivisionsByCode<
  T extends { division_code: string; subdivision_code: string; name: string | null },
>(subs: T[]): T[] {
  return [...subs].sort((a, b) =>
    a.subdivision_code.localeCompare(b.subdivision_code, 'es', { numeric: true }),
  );
}

export type RegistroHeSupervisorScopeGroup = {
  slug: string;
  label: string;
  division_codes: string[];
  subdivisions: {
    division_code: string;
    subdivision_code: string;
    name: string | null;
  }[];
};

@Injectable()
export class RegistroHorasExtraService {
  constructor(
    @Inject(SAMI_DB) private readonly db: PostgresJsDatabase<typeof schema>,
    @Optional()
    @Inject(SAP_DB)
    private readonly sapDb: PostgresJsDatabase<typeof sapSchema> | null,
    private readonly orgCatalog: WorkforceOrgCatalogService,
  ) {}

  listMotivos() {
    return { items: [...REGISTRO_HE_MOTIVOS] };
  }

  async getSupervisorScope(
    supervisorSap: string,
    fullOrgAccess: boolean,
  ): Promise<{
    groups: RegistroHeSupervisorScopeGroup[];
    message: string | null;
    full_org_access: boolean;
  }> {
    const { groups: catalogGroups } = await this.orgCatalog.listArisGroupsWithSubdivisions();

    if (fullOrgAccess) {
      const groups: RegistroHeSupervisorScopeGroup[] = catalogGroups
        .map((g) => ({
          slug: g.slug,
          label: g.label,
          division_codes: [...g.division_codes],
          subdivisions: sortSubdivisionsByCode(g.subdivisions),
        }))
        .filter((g) => g.subdivisions.length > 0);
      return { groups, message: null, full_org_access: true };
    }

    const sap = supervisorSap.trim();
    const assignRows = await this.db
      .select({
        divisionCode: workforceSubdivisionRoleAssignees.divisionCode,
        subdivisionCode: workforceSubdivisionRoleAssignees.subdivisionCode,
      })
      .from(workforceSubdivisionRoleAssignees)
      .where(
        and(
          eq(workforceSubdivisionRoleAssignees.workerId, sap),
          eq(workforceSubdivisionRoleAssignees.role, 'supervisor'),
        ),
      );

    const assignSet = new Set(
      assignRows.map((r) => pairKey(r.divisionCode, r.subdivisionCode)),
    );

    const groups: RegistroHeSupervisorScopeGroup[] = [];

    for (const g of catalogGroups) {
      const subdivisions = sortSubdivisionsByCode(
        g.subdivisions.filter((s) => assignSet.has(pairKey(s.division_code, s.subdivision_code))),
      );
      if (subdivisions.length > 0) {
        groups.push({
          slug: g.slug,
          label: g.label,
          division_codes: [...g.division_codes],
          subdivisions,
        });
      }
    }

    const message =
      groups.length === 0
        ? 'No figuras como supervisor de ninguna subdivisión. Pídele a la persona que administra WorkForce (menú Ajustes) que te cargue en Organización, o consulta con sistemas.'
        : null;

    return { groups, message, full_org_access: false };
  }

  private async allowedPairSet(sap: string, fullOrgAccess: boolean): Promise<Set<string>> {
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
      })
      .from(workforceSubdivisionRoleAssignees)
      .where(
        and(
          eq(workforceSubdivisionRoleAssignees.workerId, sap.trim()),
          eq(workforceSubdivisionRoleAssignees.role, 'supervisor'),
        ),
      );
    const assignSet = new Set(
      assignRows.map((r) => pairKey(r.divisionCode, r.subdivisionCode)),
    );
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

  async searchWorkersInSubdivisions(
    supervisorSap: string,
    fullOrgAccess: boolean,
    qRaw: string,
    divisionCode: string,
    subdivisionCodes: string[],
  ): Promise<{ results: { sap_code: string; name: string }[] }> {
    if (!this.sapDb) {
      throw new ServiceUnavailableException({
        message: 'No hay conexión con los datos de personal. Probá más tarde o avisá a sistemas.',
      });
    }
    const div = divisionCode.trim();
    const subs = [...new Set(subdivisionCodes.map((s) => s.trim()).filter(Boolean))];
    if (!div || subs.length === 0) {
      return { results: [] };
    }

    const allowed = await this.allowedPairSet(supervisorSap, fullOrgAccess);
    for (const sub of subs) {
      if (!allowed.has(pairKey(div, sub))) {
        throw new BadRequestException({
          message:
            'Esa subdivisión no está disponible para tu usuario. Elegí solo las que te corresponden.',
        });
      }
    }

    const q = qRaw.trim();
    const isNumericOnly = /^\d+$/.test(q);
    if (!isNumericOnly && q.length < 2) {
      return { results: [] };
    }
    if (q.length === 0) {
      return { results: [] };
    }

    const pattern = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;

    const btrtlOr = or(...subs.map((s) => sql`trim(${eiisTrabajadores.btrtl}) = ${s}`));

    const rows = await this.sapDb
      .select()
      .from(eiisTrabajadores)
      .where(
        and(
          stat2ActivoCondition(),
          sql`trim(${eiisTrabajadores.werks}) = ${div}`,
          btrtlOr,
          isNumericOnly
            ? or(eq(eiisTrabajadores.pernr, q), ilike(eiisTrabajadores.pernr, `${q}%`))
            : or(
                ilike(eiisTrabajadores.pernr, pattern),
                ilike(eiisTrabajadores.nachn, pattern),
                ilike(eiisTrabajadores.vorna, pattern),
              ),
        ),
      )
      .limit(80);

    const byPernr = new Map<string, (typeof rows)[0]>();
    for (const row of rows) {
      if (!isTrabajadorActivoStat(row.stat2)) continue;
      const key = row.pernr.trim();
      if (!key) continue;
      const prev = byPernr.get(key);
      if (!prev || compareStagingRows(row, prev) > 0) {
        byPernr.set(key, row);
      }
    }

    const sorted = [...byPernr.values()].sort((a, b) =>
      a.pernr.trim().localeCompare(b.pernr.trim(), 'es'),
    );

    const results = sorted.slice(0, 20).map((w) => ({
      sap_code: w.pernr.trim(),
      name: formatStagingWorkerName(w.vorna, w.nachn).trim() || w.pernr.trim(),
    }));

    return { results };
  }

  async resolvePernrInScope(
    supervisorSap: string,
    fullOrgAccess: boolean,
    pernrRaw: string,
    pairs: { division_code: string; subdivision_code: string }[],
  ): Promise<{ sap_code: string; name: string } | null> {
    if (!this.sapDb) {
      throw new ServiceUnavailableException({
        message: 'No hay conexión con los datos de personal. Probá más tarde o avisá a sistemas.',
      });
    }
    const allowed = await this.allowedPairSet(supervisorSap, fullOrgAccess);
    const pairSet = new Set(pairs.map((p) => pairKey(p.division_code, p.subdivision_code)));
    for (const k of pairSet) {
      if (!allowed.has(k)) {
        throw new BadRequestException({
          message: 'Alguna subdivisión elegida no está permitida para tu usuario.',
        });
      }
    }

    const code = pernrRaw.trim();
    if (!code) return null;

    const rows = await this.sapDb
      .select()
      .from(eiisTrabajadores)
      .where(eq(eiisTrabajadores.pernr, code))
      .limit(80);

    let best: (typeof rows)[0] | undefined;
    for (const row of rows) {
      if (!isTrabajadorActivoStat(row.stat2)) continue;
      if (!best || compareStagingRows(row, best) > 0) {
        best = row;
      }
    }
    if (!best) return null;

    const w = (best.werks ?? '').trim();
    const b = (best.btrtl ?? '').trim();
    if (!pairSet.has(pairKey(w, b))) {
      return null;
    }

    return {
      sap_code: best.pernr.trim(),
      name: formatStagingWorkerName(best.vorna, best.nachn).trim() || best.pernr.trim(),
    };
  }

  private async assertBoletaPayloadValid(supervisorSap: string, fullOrgAccess: boolean, body: CreateHeBoletaBody) {
    const allowed = await this.allowedPairSet(supervisorSap, fullOrgAccess);
    for (const p of body.subdivision_pairs) {
      if (!allowed.has(pairKey(p.division_code, p.subdivision_code))) {
        throw new BadRequestException({
          message: 'Revisá las subdivisiones: alguna no está permitida para tu usuario.',
        });
      }
    }

    if (body.motivo_code !== null && body.motivo_code !== undefined) {
      const motivoOk = REGISTRO_HE_MOTIVOS.some((m) => m.code === body.motivo_code);
      if (!motivoOk) {
        throw new BadRequestException({ message: 'El motivo elegido no es válido.' });
      }
    }

    const pairList = body.subdivision_pairs;

    for (const line of body.lines) {
      const resolved = await this.resolvePernrInScope(
        supervisorSap,
        fullOrgAccess,
        line.pernr,
        pairList,
      );
      if (!resolved) {
        throw new BadRequestException({
          message: `No encontramos al colaborador ${line.pernr.trim()} en las subdivisiones que elegiste, o el código no coincide.`,
        });
      }
      if (line.motivo_code !== null && line.motivo_code !== undefined) {
        const mOk = REGISTRO_HE_MOTIVOS.some((m) => m.code === line.motivo_code);
        if (!mOk) {
          throw new BadRequestException({
            message: `El motivo de la fila del código ${line.pernr.trim()} no es válido.`,
          });
        }
      }
    }
  }

  async createBoleta(
    supervisorSap: string,
    fullOrgAccess: boolean,
    body: CreateHeBoletaBody,
  ) {
    const headerTimeStart = body.time_start ?? '08:00';
    const headerTimeEnd = body.time_end ?? '18:00';

    await this.assertBoletaPayloadValid(supervisorSap, fullOrgAccess, body);

    const pairList = body.subdivision_pairs;

    const { headerId, displayNumber } = await this.db.transaction(async (tx) => {
      const [h] = await tx
        .insert(heBoletaHeaders)
        .values({
          createdBy: supervisorSap.trim(),
          groupSlug: body.group_slug.trim(),
          divisionCode: body.division_code.trim(),
          subdivisionPairs: pairList.map((p) => ({
            division_code: p.division_code.trim(),
            subdivision_code: p.subdivision_code.trim(),
          })),
          validFrom: body.valid_from,
          validTo: body.valid_to,
          timeStart: headerTimeStart,
          timeEnd: headerTimeEnd,
          motivoCode: body.motivo_code?.trim() ?? null,
          status: 'registrada',
        })
        .returning({ id: heBoletaHeaders.id, displayNumber: heBoletaHeaders.displayNumber });

      const hid = h?.id;
      const num = h?.displayNumber;
      if (!hid || num == null) {
        throw new NotFoundException({ message: 'No se pudo guardar la boleta. Probá de nuevo.' });
      }

      await tx.insert(heBoletaLines).values(
        body.lines.map((line) => ({
          headerId: hid,
          pernr: line.pernr.trim(),
          workerName: line.worker_name?.trim() || null,
          validFrom: line.valid_from,
          validTo: line.valid_to,
          days: line.days,
          timeStart: line.time_start,
          timeEnd: line.time_end,
          motivoCode: line.motivo_code?.trim() ?? null,
          observaciones: line.observaciones?.trim() || null,
        })),
      );

      return { headerId: hid, displayNumber: num };
    });

    return { id: headerId, display_number: displayNumber, ok: true as const };
  }

  async updateBoleta(
    supervisorSap: string,
    fullOrgAccess: boolean,
    headerId: string,
    body: CreateHeBoletaBody,
  ): Promise<{ ok: true }> {
    const [h] = await this.db
      .select()
      .from(heBoletaHeaders)
      .where(eq(heBoletaHeaders.id, headerId))
      .limit(1);
    if (!h) {
      throw new NotFoundException({ message: 'No encontramos la boleta.' });
    }
    const st = (h.status ?? '').trim().toLowerCase();
    if (st !== 'registrada') {
      throw new BadRequestException({
        message: 'Solo se pueden editar boletas en estado registrada.',
      });
    }

    const allowed = await this.allowedPairSet(supervisorSap, fullOrgAccess);
    const existingPairs = (h.subdivisionPairs ?? []) as {
      division_code: string;
      subdivision_code: string;
    }[];
    const visible = existingPairs.some((p) => allowed.has(pairKey(p.division_code, p.subdivision_code)));
    if (!visible) {
      throw new ForbiddenException({ message: 'No puedes editar esta boleta.' });
    }

    await this.assertBoletaPayloadValid(supervisorSap, fullOrgAccess, body);

    const headerTimeStart = body.time_start ?? '08:00';
    const headerTimeEnd = body.time_end ?? '18:00';
    const pairList = body.subdivision_pairs.map((p) => ({
      division_code: p.division_code.trim(),
      subdivision_code: p.subdivision_code.trim(),
    }));

    await this.db.transaction(async (tx) => {
      await tx
        .update(heBoletaHeaders)
        .set({
          groupSlug: body.group_slug.trim(),
          divisionCode: body.division_code.trim(),
          subdivisionPairs: pairList,
          validFrom: body.valid_from,
          validTo: body.valid_to,
          timeStart: headerTimeStart,
          timeEnd: headerTimeEnd,
          motivoCode: body.motivo_code?.trim() ?? null,
        })
        .where(eq(heBoletaHeaders.id, headerId));

      await tx.delete(heBoletaLines).where(eq(heBoletaLines.headerId, headerId));

      await tx.insert(heBoletaLines).values(
        body.lines.map((line) => ({
          headerId,
          pernr: line.pernr.trim(),
          workerName: line.worker_name?.trim() || null,
          validFrom: line.valid_from,
          validTo: line.valid_to,
          days: line.days,
          timeStart: line.time_start,
          timeEnd: line.time_end,
          motivoCode: line.motivo_code?.trim() ?? null,
          observaciones: line.observaciones?.trim() || null,
        })),
      );
    });

    return { ok: true as const };
  }
}
