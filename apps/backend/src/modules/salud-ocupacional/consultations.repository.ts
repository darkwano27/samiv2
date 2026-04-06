import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  ne,
  or,
} from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { SAMI_DB, SAP_DB } from '@core/database/database.module';
import * as schema from '@core/database/schema';
import { workers } from '@core/database/schema/workers';
import {
  soConsultationDiagnoses,
  soConsultations,
  soDiagnoses,
  soMedicines,
  soPrescriptions,
} from '@core/database/schema/salud-ocupacional';
import * as sapSchema from '@core/database/schema-sap';
import { eiisTrabajadores } from '@core/database/schema-sap/eiis-trabajadores';
import type {
  CreateConsultationBody,
  HistorialQuery,
  MyConsultationsQuery,
  UpdateDiagnosisBody,
  UpdateMedicineBody,
} from './dto/consultations.dto';

const HISTORIAL_EXPORT_MAX = 5000;

const SAP_STAT_ACTIVO = 3;

function isTrabajadorActivoStat(stat2: string | null | undefined): boolean {
  return Number(String(stat2 ?? '').trim()) === SAP_STAT_ACTIVO;
}

function ageFromGbdat(gbdat: string | null | undefined): number | null {
  const s = (gbdat ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age -= 1;
  }
  if (age < 0 || age > 130) return null;
  return age;
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

export type SapWorkerRow = {
  cod: string;
  name: string;
  /** Sede (campo `sede`, ej. ARIS LIMA). */
  sede: string | null;
  /** Cargo / puesto SAP (`stext`). */
  jobTitle: string | null;
  /** Compat. UI: cargo o fallback werks/btrtl. */
  position: string | null;
  division: string | null;
  subdivision: string | null;
  /** Edad en años si hay fecha de nacimiento en réplica; hoy suele ser null. */
  age: number | null;
  emailCorp: string | null;
  emailPersonal: string | null;
  isActive: boolean;
};

/** Snapshot maestro SAP persistido en `so_consultations` (export / auditoría). */
export type SapPatientSnapshot = {
  sede: string | null;
  jobTitle: string | null;
  documentId: string | null;
  birthDateRaw: string | null;
  costCenter: string | null;
  hireDate: string | null;
};

function mapEiisRowToSapWorker(
  w: typeof eiisTrabajadores.$inferSelect,
  isActive: boolean,
): SapWorkerRow {
  const name =
    `${(w.vorna ?? '').trim()} ${(w.nachn ?? '').trim()}`.trim() || '—';
  const sede = (w.sede ?? '').trim() || null;
  const jobTitle = (w.stext ?? '').trim() || null;
  const position =
    jobTitle ||
    [w.werks, w.btrtl].filter(Boolean).join(' · ').trim() ||
    null;
  return {
    cod: w.pernr.trim(),
    name,
    sede,
    jobTitle: jobTitle || null,
    position: position || null,
    division: w.txtDiv?.trim() ?? null,
    subdivision: w.txtSubdiv?.trim() ?? null,
    age: ageFromGbdat(w.gbdat),
    emailCorp: w.correoCorp?.trim() || null,
    emailPersonal: w.correo?.trim() || null,
    isActive,
  };
}

/**
 * Acceso a datos Salud ocupacional (SAMI_DB / SAP_DB). Sin reglas de negocio.
 */
@Injectable()
export class ConsultationsRepository {
  constructor(
    @Inject(SAMI_DB)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @Optional()
    @Inject(SAP_DB)
    private readonly sapDb: PostgresJsDatabase<typeof sapSchema> | null,
  ) {}

  hasSap(): boolean {
    return this.sapDb != null;
  }

  /**
   * Mejor fila vigente `eiis_trabajadores` por `pernr` (activo), o null.
   */
  private async findBestEiisRow(
    pernrRaw: string,
  ): Promise<typeof eiisTrabajadores.$inferSelect | null> {
    if (!this.sapDb) return null;
    const code = pernrRaw.trim();
    if (!code) return null;
    const rows = await this.sapDb
      .select()
      .from(eiisTrabajadores)
      .where(eq(eiisTrabajadores.pernr, code));
    let best: (typeof rows)[0] | undefined;
    for (const row of rows) {
      if (!isTrabajadorActivoStat(row.stat2)) continue;
      if (!best || compareStagingRows(row, best) > 0) best = row;
    }
    return best ?? null;
  }

  /** Campos maestro para snapshot al crear consulta (`eiis_trabajadores`). */
  async getSapPatientSnapshot(pernrRaw: string): Promise<SapPatientSnapshot | null> {
    const best = await this.findBestEiisRow(pernrRaw);
    if (!best) return null;
    return {
      sede: best.sede?.trim() || null,
      jobTitle: best.stext?.trim() || null,
      documentId: best.perid?.trim() || null,
      birthDateRaw: best.gbdat?.trim() || null,
      costCenter: best.cecoDist?.trim() || null,
      hireDate: best.datin?.trim() || null,
    };
  }

  /** Valores distintos para filtros de historial (empresa). */
  async listHistorialFilterMeta(): Promise<{
    divisions: string[];
    subdivisions: string[];
  }> {
    const [divRows, subRows] = await Promise.all([
      this.db
        .selectDistinct({ v: soConsultations.patientDivision })
        .from(soConsultations)
        .where(isNotNull(soConsultations.patientDivision)),
      this.db
        .selectDistinct({ v: soConsultations.patientSubdivision })
        .from(soConsultations)
        .where(isNotNull(soConsultations.patientSubdivision)),
    ]);
    const divisions = [
      ...new Set(
        divRows
          .map((r) => (r.v ?? '').trim())
          .filter((s) => s.length > 0),
      ),
    ].sort((a, b) => a.localeCompare(b, 'es'));
    const subdivisions = [
      ...new Set(
        subRows
          .map((r) => (r.v ?? '').trim())
          .filter((s) => s.length > 0),
      ),
    ].sort((a, b) => a.localeCompare(b, 'es'));
    return { divisions, subdivisions };
  }

  /** Un trabajador activo vigente por `pernr` exacto (trim). */
  async getSapWorkerByPernr(pernrRaw: string): Promise<SapWorkerRow | null> {
    return this.findBestEiisRow(pernrRaw).then((best) =>
      best ? mapEiisRowToSapWorker(best, true) : null,
    );
  }

  async searchSapWorkers(qRaw: string): Promise<SapWorkerRow[]> {
    if (!this.sapDb) return [];
    const q = qRaw.trim();
    if (!q) return [];

    const pattern = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    const rows = await this.sapDb
      .select()
      .from(eiisTrabajadores)
      .where(
        or(
          ilike(eiisTrabajadores.pernr, pattern),
          ilike(eiisTrabajadores.nachn, pattern),
          ilike(eiisTrabajadores.vorna, pattern),
          ilike(eiisTrabajadores.sede, pattern),
          ilike(eiisTrabajadores.txtDiv, pattern),
          ilike(eiisTrabajadores.txtSubdiv, pattern),
          ilike(eiisTrabajadores.perid, pattern),
          ilike(eiisTrabajadores.werks, pattern),
          ilike(eiisTrabajadores.btrtl, pattern),
        ),
      )
      .limit(80);

    const byPernr = new Map<string, (typeof rows)[0]>();
    for (const row of rows) {
      const key = row.pernr.trim();
      if (!key) continue;
      const prev = byPernr.get(key);
      if (!prev || compareStagingRows(row, prev) > 0) {
        byPernr.set(key, row);
      }
    }

    const sorted = [...byPernr.values()].sort((a, b) => {
      const actA = isTrabajadorActivoStat(a.stat2) ? 0 : 1;
      const actB = isTrabajadorActivoStat(b.stat2) ? 0 : 1;
      if (actA !== actB) return actA - actB;
      return a.pernr.trim().localeCompare(b.pernr.trim(), 'es');
    });

    return sorted.slice(0, 15).map((w) =>
      mapEiisRowToSapWorker(w, isTrabajadorActivoStat(w.stat2)),
    );
  }

  async listActiveDiagnoses() {
    return this.db
      .select({
        id: soDiagnoses.id,
        name: soDiagnoses.name,
        code: soDiagnoses.code,
        isActive: soDiagnoses.isActive,
      })
      .from(soDiagnoses)
      .where(eq(soDiagnoses.isActive, true))
      .orderBy(asc(soDiagnoses.name));
  }

  async listActiveMedicines() {
    return this.db
      .select({
        id: soMedicines.id,
        name: soMedicines.name,
        presentation: soMedicines.presentation,
        concentration: soMedicines.concentration,
        administrationRoute: soMedicines.administrationRoute,
        inventoryUnit: soMedicines.inventoryUnit,
        isActive: soMedicines.isActive,
      })
      .from(soMedicines)
      .where(eq(soMedicines.isActive, true))
      .orderBy(asc(soMedicines.name));
  }

  async searchMedicinesByName(q: string) {
    if (q.trim().length < 2) return [];
    const pattern = `%${q.trim().replace(/%/g, '\\%')}%`;
    return this.db
      .select({
        id: soMedicines.id,
        name: soMedicines.name,
        presentation: soMedicines.presentation,
        concentration: soMedicines.concentration,
        administrationRoute: soMedicines.administrationRoute,
        inventoryUnit: soMedicines.inventoryUnit,
        isActive: soMedicines.isActive,
      })
      .from(soMedicines)
      .where(
        and(eq(soMedicines.isActive, true), ilike(soMedicines.name, pattern)),
      )
      .orderBy(asc(soMedicines.name))
      .limit(30);
  }

  async insertDiagnosis(values: { name: string; code?: string }) {
    const [row] = await this.db
      .insert(soDiagnoses)
      .values({
        name: values.name.trim(),
        code: values.code?.trim() || null,
      })
      .returning({
        id: soDiagnoses.id,
        name: soDiagnoses.name,
        code: soDiagnoses.code,
        isActive: soDiagnoses.isActive,
      });
    return row;
  }

  async findDiagnosisName(name: string) {
    const [row] = await this.db
      .select({ id: soDiagnoses.id })
      .from(soDiagnoses)
      .where(eq(soDiagnoses.name, name.trim()))
      .limit(1);
    return row ?? null;
  }

  async insertMedicine(values: {
    name: string;
    presentation: string;
    concentration: string;
    administrationRoute: string;
    inventoryUnit: string;
  }) {
    const [row] = await this.db
      .insert(soMedicines)
      .values({
        name: values.name.trim(),
        presentation: values.presentation,
        concentration: values.concentration,
        administrationRoute: values.administrationRoute,
        inventoryUnit: values.inventoryUnit,
      })
      .returning({
        id: soMedicines.id,
        name: soMedicines.name,
        presentation: soMedicines.presentation,
        concentration: soMedicines.concentration,
        administrationRoute: soMedicines.administrationRoute,
        inventoryUnit: soMedicines.inventoryUnit,
        isActive: soMedicines.isActive,
      });
    return row;
  }

  async findMedicinesByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(soMedicines)
      .where(
        and(inArray(soMedicines.id, ids), eq(soMedicines.isActive, true)),
      );
  }

  async listAllDiagnosesCatalog() {
    return this.db
      .select({
        id: soDiagnoses.id,
        name: soDiagnoses.name,
        code: soDiagnoses.code,
        isActive: soDiagnoses.isActive,
        createdAt: soDiagnoses.createdAt,
      })
      .from(soDiagnoses)
      .orderBy(asc(soDiagnoses.name));
  }

  async listAllMedicinesCatalog() {
    return this.db
      .select({
        id: soMedicines.id,
        name: soMedicines.name,
        presentation: soMedicines.presentation,
        concentration: soMedicines.concentration,
        administrationRoute: soMedicines.administrationRoute,
        inventoryUnit: soMedicines.inventoryUnit,
        isActive: soMedicines.isActive,
        createdAt: soMedicines.createdAt,
      })
      .from(soMedicines)
      .orderBy(asc(soMedicines.name));
  }

  async getDiagnosisById(id: string) {
    const [row] = await this.db
      .select()
      .from(soDiagnoses)
      .where(eq(soDiagnoses.id, id))
      .limit(1);
    return row ?? null;
  }

  async getMedicineById(id: string) {
    const [row] = await this.db
      .select()
      .from(soMedicines)
      .where(eq(soMedicines.id, id))
      .limit(1);
    return row ?? null;
  }

  async findDiagnosisNameExcluding(name: string, excludeId: string) {
    const [row] = await this.db
      .select({ id: soDiagnoses.id })
      .from(soDiagnoses)
      .where(
        and(eq(soDiagnoses.name, name.trim()), ne(soDiagnoses.id, excludeId)),
      )
      .limit(1);
    return row ?? null;
  }

  async updateDiagnosisById(id: string, body: UpdateDiagnosisBody) {
    const [row] = await this.db
      .update(soDiagnoses)
      .set({
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.code !== undefined ? { code: body.code?.trim() || null } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      })
      .where(eq(soDiagnoses.id, id))
      .returning({
        id: soDiagnoses.id,
        name: soDiagnoses.name,
        code: soDiagnoses.code,
        isActive: soDiagnoses.isActive,
        createdAt: soDiagnoses.createdAt,
      });
    return row ?? null;
  }

  async updateMedicineById(id: string, body: UpdateMedicineBody) {
    const [row] = await this.db
      .update(soMedicines)
      .set({
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.presentation !== undefined ? { presentation: body.presentation } : {}),
        ...(body.concentration !== undefined
          ? { concentration: body.concentration.trim() }
          : {}),
        ...(body.administrationRoute !== undefined
          ? { administrationRoute: body.administrationRoute }
          : {}),
        ...(body.inventoryUnit !== undefined
          ? { inventoryUnit: body.inventoryUnit }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      })
      .where(eq(soMedicines.id, id))
      .returning({
        id: soMedicines.id,
        name: soMedicines.name,
        presentation: soMedicines.presentation,
        concentration: soMedicines.concentration,
        administrationRoute: soMedicines.administrationRoute,
        inventoryUnit: soMedicines.inventoryUnit,
        isActive: soMedicines.isActive,
        createdAt: soMedicines.createdAt,
      });
    return row ?? null;
  }

  async findDiagnosesByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(soDiagnoses)
      .where(and(inArray(soDiagnoses.id, ids), eq(soDiagnoses.isActive, true)));
  }

  async ensureWorkerRow(sapCode: string, displayName: string) {
    await this.db
      .insert(workers)
      .values({
        id: sapCode.trim(),
        name: displayName.trim() || `Worker ${sapCode}`,
      })
      .onConflictDoUpdate({
        target: workers.id,
        set: {
          name: displayName.trim() || `Worker ${sapCode}`,
          updatedAt: new Date(),
        },
      });
  }

  async createConsultationBundle(
    body: CreateConsultationBody,
    createdBy: string,
    prescriptionSnapshots: {
      medicineId: string;
      medicineName: string;
      presentation: string;
      concentration: string;
      administrationRoute: string;
      frequency?: string;
      duration?: string;
      quantity: number;
      instructions?: string;
    }[],
    sapSnapshot: SapPatientSnapshot | null,
  ) {
    const attentionDate = new Date(body.attentionDate);
    return this.db.transaction(async (tx) => {
      const [consultation] = await tx
        .insert(soConsultations)
        .values({
          patientCod: body.patientCod.trim(),
          patientName: body.patientName.trim(),
          patientPosition:
            sapSnapshot?.jobTitle?.trim() ||
            body.patientPosition?.trim() ||
            null,
          patientDivision: body.patientDivision?.trim() || null,
          patientSubdivision: body.patientSubdivision?.trim() || null,
          patientEstabl: sapSnapshot?.sede ?? null,
          patientDocumentId: sapSnapshot?.documentId ?? null,
          patientBirthDate: sapSnapshot?.birthDateRaw ?? null,
          patientCostCenter: sapSnapshot?.costCenter ?? null,
          patientHireDate: sapSnapshot?.hireDate ?? null,
          patientAge: body.patientAge ?? null,
          patientEmail: body.patientEmail?.trim() || null,
          referredByCod: body.referredByCod?.trim() || null,
          referredByName: body.referredByName?.trim() || null,
          attentionDate,
          reason: body.reason.trim(),
          dischargeCondition: body.dischargeCondition,
          receiptNumber: body.receiptNumber?.trim() || null,
          emailTo: body.emailTo?.trim() || null,
          emailCc: body.emailCc ?? null,
          signatureData: body.signatureData?.trim() || null,
          createdBy: createdBy.trim(),
        })
        .returning({
          id: soConsultations.id,
          correlative: soConsultations.correlative,
        });

      const cid = consultation?.id;
      const correlative = consultation?.correlative;
      if (!cid || correlative == null) {
        throw new Error('insert consultation failed');
      }

      if (body.diagnosisIds.length > 0) {
        await tx.insert(soConsultationDiagnoses).values(
          body.diagnosisIds.map((diagnosisId) => ({
            consultationId: cid,
            diagnosisId,
          })),
        );
      }

      if (prescriptionSnapshots.length > 0) {
        await tx.insert(soPrescriptions).values(
          prescriptionSnapshots.map((p) => ({
            consultationId: cid,
            medicineId: p.medicineId,
            medicineName: p.medicineName,
            presentation: p.presentation,
            concentration: p.concentration,
            administrationRoute: p.administrationRoute,
            frequency: p.frequency?.trim() || null,
            duration: p.duration?.trim() || null,
            quantity: p.quantity,
            instructions: p.instructions?.trim() || null,
          })),
        );
      }

      return { id: cid, correlative };
    });
  }

  async countHistorial(filters: HistorialQuery) {
    const cond = this.historialConditions(filters);
    const [row] = await this.db
      .select({ n: count() })
      .from(soConsultations)
      .where(cond);
    return Number(row?.n ?? 0);
  }

  async listHistorial(filters: HistorialQuery) {
    const page = filters.page;
    const limit = filters.limit;
    const offset = (page - 1) * limit;
    const cond = this.historialConditions(filters);

    const rows = await this.db
      .select({
        id: soConsultations.id,
        correlative: soConsultations.correlative,
        patientCod: soConsultations.patientCod,
        patientName: soConsultations.patientName,
        patientPosition: soConsultations.patientPosition,
        patientDivision: soConsultations.patientDivision,
        patientSubdivision: soConsultations.patientSubdivision,
        patientEstabl: soConsultations.patientEstabl,
        attentionDate: soConsultations.attentionDate,
        reason: soConsultations.reason,
        dischargeCondition: soConsultations.dischargeCondition,
        createdAt: soConsultations.createdAt,
      })
      .from(soConsultations)
      .where(cond)
      .orderBy(desc(soConsultations.attentionDate))
      .limit(limit)
      .offset(offset);

    return rows;
  }

  private historialConditions(filters: HistorialQuery) {
    const parts = [];
    const s = filters.search?.trim();
    if (s && s.length >= 2) {
      const p = `%${s.replace(/%/g, '\\%')}%`;
      parts.push(
        or(
          ilike(soConsultations.patientName, p),
          ilike(soConsultations.patientCod, p),
        ),
      );
    }
    const div = filters.division?.trim();
    if (div && div.length >= 1) {
      const p = `%${div.replace(/%/g, '\\%')}%`;
      parts.push(ilike(soConsultations.patientDivision, p));
    }
    const subdiv = filters.subdivision?.trim();
    if (subdiv && subdiv.length >= 1) {
      const p = `%${subdiv.replace(/%/g, '\\%')}%`;
      parts.push(ilike(soConsultations.patientSubdivision, p));
    }
    if (filters.dateFrom) {
      parts.push(
        gte(soConsultations.attentionDate, new Date(filters.dateFrom)),
      );
    }
    if (filters.dateTo) {
      parts.push(
        lte(soConsultations.attentionDate, new Date(filters.dateTo)),
      );
    }
    if (parts.length === 0) return undefined;
    if (parts.length === 1) return parts[0];
    return and(...parts);
  }

  /**
   * Filas para CSV: una por cada fármaco; si no hay recetas, una fila con fármaco vacío.
   */
  async listHistorialExportForCsv(filters: HistorialQuery): Promise<
    {
      row: typeof soConsultations.$inferSelect;
      diagnosisText: string;
      medicineName: string;
      quantity: number | null;
      dischargeLabel: string;
    }[]
  > {
    const cond = this.historialConditions(filters);
    const consultations = await this.db
      .select()
      .from(soConsultations)
      .where(cond)
      .orderBy(desc(soConsultations.attentionDate))
      .limit(HISTORIAL_EXPORT_MAX);

    if (consultations.length === 0) return [];

    const ids = consultations.map((c) => c.id);
    const dxJoined = await this.db
      .select({
        consultationId: soConsultationDiagnoses.consultationId,
        name: soDiagnoses.name,
      })
      .from(soConsultationDiagnoses)
      .innerJoin(
        soDiagnoses,
        eq(soConsultationDiagnoses.diagnosisId, soDiagnoses.id),
      )
      .where(inArray(soConsultationDiagnoses.consultationId, ids));

    const rxRows = await this.db
      .select()
      .from(soPrescriptions)
      .where(inArray(soPrescriptions.consultationId, ids));

    const dxByC = new Map<string, string[]>();
    for (const r of dxJoined) {
      const k = r.consultationId;
      const arr = dxByC.get(k) ?? [];
      arr.push(r.name);
      dxByC.set(k, arr);
    }

    const rxByC = new Map<string, typeof rxRows>();
    for (const r of rxRows) {
      const k = r.consultationId;
      const arr = rxByC.get(k) ?? [];
      arr.push(r);
      rxByC.set(k, arr);
    }

    const dischargeLabel: Record<string, string> = {
      observacion: 'Observación',
      recuperado: 'Recuperado',
      derivado: 'Derivado',
    };

    const out: {
      row: typeof soConsultations.$inferSelect;
      diagnosisText: string;
      medicineName: string;
      quantity: number | null;
      dischargeLabel: string;
    }[] = [];

    for (const c of consultations) {
      const diag = (dxByC.get(c.id) ?? []).join(', ');
      const rxList = rxByC.get(c.id) ?? [];
      const condLabel =
        dischargeLabel[c.dischargeCondition] ?? c.dischargeCondition;
      if (rxList.length === 0) {
        out.push({
          row: c,
          diagnosisText: diag,
          medicineName: '',
          quantity: null,
          dischargeLabel: condLabel,
        });
      } else {
        for (const rx of rxList) {
          out.push({
            row: c,
            diagnosisText: diag,
            medicineName: rx.medicineName,
            quantity: rx.quantity,
            dischargeLabel: condLabel,
          });
        }
      }
    }
    return out;
  }

  /**
   * Mis consultas = atenciones donde el usuario logueado es el **paciente** (`patient_cod` = SAP).
   */
  private myConsultationsWhere(
    viewerSap: string,
    query: Pick<MyConsultationsQuery, 'dateFrom' | 'dateTo'>,
  ) {
    const parts = [eq(soConsultations.patientCod, viewerSap.trim())];
    const df = query.dateFrom?.trim();
    const dt = query.dateTo?.trim();
    if (df) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(df)) {
        parts.push(
          gte(soConsultations.attentionDate, new Date(`${df}T00:00:00.000`)),
        );
      } else {
        const d = new Date(df);
        if (!Number.isNaN(d.getTime())) {
          parts.push(gte(soConsultations.attentionDate, d));
        }
      }
    }
    if (dt) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) {
        parts.push(
          lte(soConsultations.attentionDate, new Date(`${dt}T23:59:59.999`)),
        );
      } else {
        const d = new Date(dt);
        if (!Number.isNaN(d.getTime())) {
          parts.push(lte(soConsultations.attentionDate, d));
        }
      }
    }
    if (parts.length === 1) return parts[0];
    return and(...parts);
  }

  async countMyConsultations(
    viewerSap: string,
    query: Pick<MyConsultationsQuery, 'dateFrom' | 'dateTo'>,
  ) {
    const w = this.myConsultationsWhere(viewerSap, query);
    const [row] = await this.db
      .select({ n: count() })
      .from(soConsultations)
      .where(w);
    return Number(row?.n ?? 0);
  }

  async listMyConsultations(
    viewerSap: string,
    page: number,
    limit: number,
    query: Pick<MyConsultationsQuery, 'dateFrom' | 'dateTo'>,
  ) {
    const offset = (page - 1) * limit;
    const w = this.myConsultationsWhere(viewerSap, query);
    return this.db
      .select({
        id: soConsultations.id,
        correlative: soConsultations.correlative,
        patientCod: soConsultations.patientCod,
        patientName: soConsultations.patientName,
        attentionDate: soConsultations.attentionDate,
        reason: soConsultations.reason,
        dischargeCondition: soConsultations.dischargeCondition,
        createdAt: soConsultations.createdAt,
      })
      .from(soConsultations)
      .where(w)
      .orderBy(desc(soConsultations.attentionDate))
      .limit(limit)
      .offset(offset);
  }

  async getConsultationBase(id: string) {
    const [row] = await this.db
      .select()
      .from(soConsultations)
      .where(eq(soConsultations.id, id))
      .limit(1);
    return row ?? null;
  }

  async getConsultationDetail(id: string) {
    const base = await this.getConsultationBase(id);
    if (!base) return null;

    const diagnoses = await this.db
      .select({
        id: soDiagnoses.id,
        name: soDiagnoses.name,
        code: soDiagnoses.code,
      })
      .from(soConsultationDiagnoses)
      .innerJoin(
        soDiagnoses,
        eq(soConsultationDiagnoses.diagnosisId, soDiagnoses.id),
      )
      .where(eq(soConsultationDiagnoses.consultationId, id));

    const prescriptions = await this.db
      .select({
        id: soPrescriptions.id,
        medicineName: soPrescriptions.medicineName,
        presentation: soPrescriptions.presentation,
        concentration: soPrescriptions.concentration,
        administrationRoute: soPrescriptions.administrationRoute,
        frequency: soPrescriptions.frequency,
        duration: soPrescriptions.duration,
        quantity: soPrescriptions.quantity,
        instructions: soPrescriptions.instructions,
      })
      .from(soPrescriptions)
      .where(eq(soPrescriptions.consultationId, id));

    return { ...base, diagnoses, prescriptions };
  }
}

/** Resultado de `getConsultationDetail` (incluye `null` si no existe). */
export type ConsultationDetail = Awaited<
  ReturnType<ConsultationsRepository['getConsultationDetail']>
>;
