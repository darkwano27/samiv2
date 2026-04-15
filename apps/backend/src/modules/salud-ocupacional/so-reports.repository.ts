import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { SAMI_DB, SAP_DB } from '@core/database/database.module';
import * as schema from '@core/database/schema';
import {
  soConsultationDiagnoses,
  soConsultations,
  soDiagnoses,
  soPrescriptions,
} from '@core/database/schema/salud-ocupacional';
import * as sapSchema from '@core/database/schema-sap';
import { eiisTrabajadores } from '@core/database/schema-sap/eiis-trabajadores';

export type SoReportDateRange = {
  from: Date;
  to: Date;
  /** Código división UI (AR10…) → patrones SAP. */
  division?: string;
  /** Texto snapshot `patient_subdivision` (coincidencia plegada). */
  subdivision?: string;
};

const SAP_STAT_ACTIVO = '3';

/**
 * Filtro por división: el snapshot en `patient_division` suele traer texto SAP (nombre),
 * no siempre el código ARxx. Se hace OR de patrones por código seleccionado.
 */
const DIVISION_CODE_TO_PATTERNS: Record<string, string[]> = {
  AR10: ['AR10', 'Textil', 'TEXTIL'],
  AR20: [
    'AR20',
    'Cerámico',
    'Ceramicos',
    'Cerámicos',
    'CERAMICO',
    'CERÁMICO',
  ],
  AR30: ['AR30', 'Químico', 'Quimico', 'Químicos', 'QUIMICO', 'QUÍMICO'],
  AR80: ['AR80', 'Operaciones', 'OPERACIONES'],
  AR90: [
    'AR90',
    'Administración',
    'Administracion',
    'Finanzas',
    'FINANZAS',
    'ADMINISTRACIÓN Y FINANZAS',
    'ADMINISTRACION Y FINANZAS',
  ],
};

/** Quita diacríticos para comparar textos SAP (división/subdivisión) con el filtro UI. */
function foldAscii(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

@Injectable()
export class SoReportsRepository {
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

  /** Coincidencia en división/subdivisión snapshot (texto SAP). */
  private divisionFilterOr(divisionCode: string) {
    const key = divisionCode.trim().toUpperCase();
    const patterns = DIVISION_CODE_TO_PATTERNS[key] ?? [key];
    const uniq = [...new Set(patterns.map((p) => p.trim()).filter(Boolean))];
    /** Texto combinado, minúsculas y sin tildes → `LIKE` con needle ya plegado. */
    const folded = sql<string>`translate(lower(COALESCE(${soConsultations.patientDivision}, '') || ' ' || COALESCE(${soConsultations.patientSubdivision}, '')), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')`;
    const clauses = uniq.map((raw) => {
      const needle = foldAscii(raw);
      if (!needle) return sql`FALSE`;
      const pattern = `%${needle}%`;
      return sql`${folded} LIKE ${pattern}`;
    });
    if (clauses.length === 0) return sql`FALSE`;
    return or(...clauses) ?? sql`FALSE`;
  }

  /** Coincidencia solo en `patient_subdivision` (texto SAP snapshot). */
  private subdivisionFilter(subdivisionNeedle: string) {
    const needle = foldAscii(subdivisionNeedle.trim());
    if (!needle) return sql`FALSE`;
    const pattern = `%${needle}%`;
    const foldedSub = sql<string>`translate(lower(COALESCE(${soConsultations.patientSubdivision}, '')), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')`;
    return sql`${foldedSub} LIKE ${pattern}`;
  }

  private rangeWhere(range: SoReportDateRange) {
    const parts = [
      gte(soConsultations.attentionDate, range.from),
      lte(soConsultations.attentionDate, range.to),
    ];
    const d = range.division?.trim();
    if (d) {
      parts.push(this.divisionFilterOr(d));
    }
    const s = range.subdivision?.trim();
    if (s) {
      parts.push(this.subdivisionFilter(s));
    }
    return and(...parts);
  }

  /** Subdivisiones distintas en el periodo (y división UI si aplica), para poblar el filtro. */
  async listSubdivisionsInRange(range: SoReportDateRange): Promise<string[]> {
    const parts = [
      gte(soConsultations.attentionDate, range.from),
      lte(soConsultations.attentionDate, range.to),
    ];
    const d = range.division?.trim();
    if (d) parts.push(this.divisionFilterOr(d));
    parts.push(sql`TRIM(COALESCE(${soConsultations.patientSubdivision}, '')) <> ''`);
    const rows = await this.db
      .selectDistinct({ v: soConsultations.patientSubdivision })
      .from(soConsultations)
      .where(and(...parts));
    return [
      ...new Set(
        rows
          .map((r) => (r.v ?? '').trim())
          .filter((s) => s.length > 0),
      ),
    ].sort((a, b) => a.localeCompare(b, 'es'));
  }

  async countConsultations(range: SoReportDateRange): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(soConsultations)
      .where(this.rangeWhere(range));
    return Number(row?.n ?? 0);
  }

  async countDistinctPatients(range: SoReportDateRange): Promise<number> {
    const [row] = await this.db
      .select({ n: countDistinct(soConsultations.patientCod) })
      .from(soConsultations)
      .where(this.rangeWhere(range));
    return Number(row?.n ?? 0);
  }

  /** Trabajadores con 2+ consultas en el periodo (reincidentes en ventana). */
  async countReincidentPatients(range: SoReportDateRange): Promise<number> {
    const rows = await this.db
      .select({ patientCod: soConsultations.patientCod })
      .from(soConsultations)
      .where(this.rangeWhere(range))
      .groupBy(soConsultations.patientCod)
      .having(gt(count(), 1));
    return rows.length;
  }

  async countByDischarge(
    range: SoReportDateRange,
  ): Promise<{ condition: string; n: number }[]> {
    const rows = await this.db
      .select({
        condition: soConsultations.dischargeCondition,
        n: count(),
      })
      .from(soConsultations)
      .where(this.rangeWhere(range))
      .groupBy(soConsultations.dischargeCondition);
    return rows.map((r) => ({ condition: r.condition, n: Number(r.n) }));
  }

  async countConsultationsByDischargeCondition(
    range: SoReportDateRange,
    condition: 'derivado' | 'observacion' | 'recuperado',
  ): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(soConsultations)
      .where(
        and(this.rangeWhere(range), eq(soConsultations.dischargeCondition, condition)),
      );
    return Number(row?.n ?? 0);
  }

  /** Atenciones por mes y sede (snapshot `patient_establ`), misma ventana que tendencia mensual. */
  async monthlyConsultationsByEstablishment(params: {
    anchor: Date;
    months: number;
    division?: string;
    subdivision?: string;
  }): Promise<{ month: string; establishment: string; n: number }[]> {
    const { anchor, months, division, subdivision } = params;
    const start = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - (months - 1), 1),
    );
    const end = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );
    const range: SoReportDateRange = { from: start, to: end, division, subdivision };

    const rows = await this.db
      .select({
        month: sql<string>`TO_CHAR(${soConsultations.attentionDate} AT TIME ZONE 'UTC', 'YYYY-MM')`,
        establishment: sql<string>`COALESCE(NULLIF(TRIM(${soConsultations.patientEstabl}), ''), 'Sin sede')`,
        n: count(),
      })
      .from(soConsultations)
      .where(this.rangeWhere(range))
      .groupBy(
        sql`TO_CHAR(${soConsultations.attentionDate} AT TIME ZONE 'UTC', 'YYYY-MM')`,
        sql`COALESCE(NULLIF(TRIM(${soConsultations.patientEstabl}), ''), 'Sin sede')`,
      )
      .orderBy(asc(sql`TO_CHAR(${soConsultations.attentionDate} AT TIME ZONE 'UTC', 'YYYY-MM')`));

    return rows.map((r) => ({
      month: r.month,
      establishment: r.establishment,
      n: Number(r.n),
    }));
  }

  async topDiagnoses(
    range: SoReportDateRange,
    limit: number,
  ): Promise<{ cieCode: string | null; name: string; count: number }[]> {
    const rows = await this.db
      .select({
        cieCode: soDiagnoses.code,
        name: soDiagnoses.name,
        n: count(),
      })
      .from(soConsultationDiagnoses)
      .innerJoin(
        soConsultations,
        eq(soConsultationDiagnoses.consultationId, soConsultations.id),
      )
      .innerJoin(soDiagnoses, eq(soConsultationDiagnoses.diagnosisId, soDiagnoses.id))
      .where(this.rangeWhere(range))
      .groupBy(soDiagnoses.id, soDiagnoses.code, soDiagnoses.name)
      .orderBy(desc(count()))
      .limit(limit);
    return rows.map((r) => ({
      cieCode: r.cieCode ?? null,
      name: r.name,
      count: Number(r.n),
    }));
  }

  async topMedications(
    range: SoReportDateRange,
    limit: number,
  ): Promise<
    { name: string; prescriptionCount: number; totalUnits: number }[]
  > {
    const rows = await this.db
      .select({
        name: soPrescriptions.medicineName,
        prescriptionCount: count(),
        totalUnits: sql<number>`COALESCE(SUM(${soPrescriptions.quantity}), 0)::int`,
      })
      .from(soPrescriptions)
      .innerJoin(
        soConsultations,
        eq(soPrescriptions.consultationId, soConsultations.id),
      )
      .where(this.rangeWhere(range))
      .groupBy(soPrescriptions.medicineName)
      .orderBy(desc(sql`COALESCE(SUM(${soPrescriptions.quantity}), 0)`))
      .limit(limit);
    return rows.map((r) => ({
      name: r.name,
      prescriptionCount: Number(r.prescriptionCount),
      totalUnits: Number(r.totalUnits),
    }));
  }

  async consultationsByDivision(
    range: SoReportDateRange,
  ): Promise<{ divisionLabel: string; consultationsCount: number }[]> {
    const rows = await this.db
      .select({
        divisionLabel: sql<string>`COALESCE(NULLIF(TRIM(${soConsultations.patientDivision}), ''), 'Sin división')`,
        n: count(),
      })
      .from(soConsultations)
      .where(this.rangeWhere(range))
      .groupBy(
        sql`COALESCE(NULLIF(TRIM(${soConsultations.patientDivision}), ''), 'Sin división')`,
      )
      .orderBy(desc(count()));
    return rows.map((r) => ({
      divisionLabel: r.divisionLabel,
      consultationsCount: Number(r.n),
    }));
  }

  /**
   * Tendencia mensual: total y desglose por condición al alta.
   * `from`/`to` del range se ignoran para el eje; se usa ventana de `months` hacia atrás desde `anchor`.
   */
  async monthlyDischargeTrend(params: {
    anchor: Date;
    months: number;
    division?: string;
    subdivision?: string;
  }): Promise<
    {
      month: string;
      total: number;
      recuperado: number;
      observacion: number;
      derivado: number;
    }[]
  > {
    const { anchor, months, division, subdivision } = params;
    const start = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - (months - 1), 1),
    );
    const end = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );

    const range: SoReportDateRange = { from: start, to: end, division, subdivision };
    const rows = await this.db
      .select({
        month: sql<string>`TO_CHAR(${soConsultations.attentionDate} AT TIME ZONE 'UTC', 'YYYY-MM')`,
        condition: soConsultations.dischargeCondition,
        n: count(),
      })
      .from(soConsultations)
      .where(this.rangeWhere(range))
      .groupBy(
        sql`TO_CHAR(${soConsultations.attentionDate} AT TIME ZONE 'UTC', 'YYYY-MM')`,
        soConsultations.dischargeCondition,
      )
      .orderBy(asc(sql`TO_CHAR(${soConsultations.attentionDate} AT TIME ZONE 'UTC', 'YYYY-MM')`));

    const byMonth = new Map<
      string,
      { total: number; recuperado: number; observacion: number; derivado: number }
    >();

    for (const r of rows) {
      const m = r.month;
      if (!byMonth.has(m)) {
        byMonth.set(m, {
          total: 0,
          recuperado: 0,
          observacion: 0,
          derivado: 0,
        });
      }
      const bucket = byMonth.get(m)!;
      const c = Number(r.n);
      bucket.total += c;
      if (r.condition === 'recuperado') bucket.recuperado += c;
      else if (r.condition === 'observacion') bucket.observacion += c;
      else if (r.condition === 'derivado') bucket.derivado += c;
    }

    const keys = [...byMonth.keys()].sort();
    return keys.map((month) => ({
      month,
      ...byMonth.get(month)!,
    }));
  }

  private utcMondayStart(d: Date): Date {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    const dow = new Date(Date.UTC(y, m, day)).getUTCDay();
    const daysFromMon = (dow + 6) % 7;
    return new Date(Date.UTC(y, m, day - daysFromMon));
  }

  private formatUtcYmd(d: Date): string {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  }

  /** Rango [lunes 00:00 UTC … domingo 23:59:59.999 UTC] de la semana que contiene `anchor`, y `weeks` semanas hacia atrás desde esa semana (incl.). */
  private weekTrendDateRange(
    anchor: Date,
    weeks: number,
    division?: string,
    subdivision?: string,
  ): { range: SoReportDateRange; weekKeys: string[]; anchorMonday: Date } {
    const anchorMonday = this.utcMondayStart(anchor);
    const windowStart = new Date(anchorMonday);
    windowStart.setUTCDate(windowStart.getUTCDate() - (weeks - 1) * 7);
    const windowEnd = new Date(anchorMonday.getTime() + 7 * 86400000 - 1);
    const range: SoReportDateRange = {
      from: windowStart,
      to: windowEnd,
      division,
      subdivision,
    };
    const weekKeys: string[] = [];
    for (let i = 0; i < weeks; i++) {
      const d = new Date(anchorMonday);
      d.setUTCDate(d.getUTCDate() - (weeks - 1 - i) * 7);
      weekKeys.push(this.formatUtcYmd(d));
    }
    return { range, weekKeys, anchorMonday };
  }

  /**
   * Tendencia semanal: total y desglose por condición al alta (lunes UTC = inicio de semana).
   */
  async weeklyDischargeTrend(params: {
    anchor: Date;
    weeks: number;
    division?: string;
    subdivision?: string;
  }): Promise<
    {
      week: string;
      total: number;
      recuperado: number;
      observacion: number;
      derivado: number;
    }[]
  > {
    const { anchor, weeks, division, subdivision } = params;
    const { range, weekKeys } = this.weekTrendDateRange(
      anchor,
      weeks,
      division,
      subdivision,
    );

    const weekSql = sql<string>`to_char(
      (date_trunc('week', ${soConsultations.attentionDate} AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::date,
      'YYYY-MM-DD'
    )`;

    const rows = await this.db
      .select({
        week: weekSql,
        condition: soConsultations.dischargeCondition,
        n: count(),
      })
      .from(soConsultations)
      .where(this.rangeWhere(range))
      .groupBy(weekSql, soConsultations.dischargeCondition)
      .orderBy(asc(weekSql));

    const byWeek = new Map<
      string,
      { total: number; recuperado: number; observacion: number; derivado: number }
    >();

    for (const r of rows) {
      const w = r.week;
      if (!byWeek.has(w)) {
        byWeek.set(w, {
          total: 0,
          recuperado: 0,
          observacion: 0,
          derivado: 0,
        });
      }
      const bucket = byWeek.get(w)!;
      const c = Number(r.n);
      bucket.total += c;
      if (r.condition === 'recuperado') bucket.recuperado += c;
      else if (r.condition === 'observacion') bucket.observacion += c;
      else if (r.condition === 'derivado') bucket.derivado += c;
    }

    return weekKeys.map((week) => ({
      week,
      ...(byWeek.get(week) ?? {
        total: 0,
        recuperado: 0,
        observacion: 0,
        derivado: 0,
      }),
    }));
  }

  /** Atenciones por semana (lunes inicio) y sede, misma ventana que tendencia semanal. */
  async weeklyConsultationsByEstablishment(params: {
    anchor: Date;
    weeks: number;
    division?: string;
    subdivision?: string;
  }): Promise<{ week: string; establishment: string; n: number }[]> {
    const { anchor, weeks, division, subdivision } = params;
    const { range } = this.weekTrendDateRange(anchor, weeks, division, subdivision);

    const weekSql = sql<string>`to_char(
      (date_trunc('week', ${soConsultations.attentionDate} AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::date,
      'YYYY-MM-DD'
    )`;

    const rows = await this.db
      .select({
        week: weekSql,
        establishment: sql<string>`COALESCE(NULLIF(TRIM(${soConsultations.patientEstabl}), ''), 'Sin sede')`,
        n: count(),
      })
      .from(soConsultations)
      .where(this.rangeWhere(range))
      .groupBy(weekSql, sql`COALESCE(NULLIF(TRIM(${soConsultations.patientEstabl}), ''), 'Sin sede')`)
      .orderBy(asc(weekSql));

    return rows.map((r) => ({
      week: r.week,
      establishment: r.establishment,
      n: Number(r.n),
    }));
  }

  async weeklyByDivisionLabels(params: {
    anchor: Date;
    weeks: number;
    division?: string;
    subdivision?: string;
  }): Promise<
    { week: string; divisionLabel: string; consultationsCount: number }[]
  > {
    const { anchor, weeks, division, subdivision } = params;
    const { range } = this.weekTrendDateRange(anchor, weeks, division, subdivision);

    const weekSql = sql<string>`to_char(
      (date_trunc('week', ${soConsultations.attentionDate} AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::date,
      'YYYY-MM-DD'
    )`;

    const rows = await this.db
      .select({
        week: weekSql,
        divisionLabel: sql<string>`COALESCE(NULLIF(TRIM(${soConsultations.patientDivision}), ''), 'Sin división')`,
        n: count(),
      })
      .from(soConsultations)
      .where(this.rangeWhere(range))
      .groupBy(
        weekSql,
        sql`COALESCE(NULLIF(TRIM(${soConsultations.patientDivision}), ''), 'Sin división')`,
      )
      .orderBy(asc(weekSql));

    return rows.map((r) => ({
      week: r.week,
      divisionLabel: r.divisionLabel,
      consultationsCount: Number(r.n),
    }));
  }

  async weeklyDiagnosisCountsForIds(params: {
    anchor: Date;
    weeks: number;
    diagnosisIds: string[];
    rangeForTop: SoReportDateRange;
  }): Promise<
    { week: string; diagnosisId: string; name: string; cieCode: string | null; n: number }[]
  > {
    const { anchor, weeks, diagnosisIds, rangeForTop } = params;
    if (diagnosisIds.length === 0) return [];

    const { range } = this.weekTrendDateRange(
      anchor,
      weeks,
      rangeForTop.division,
      rangeForTop.subdivision,
    );

    const weekSql = sql<string>`to_char(
      (date_trunc('week', ${soConsultations.attentionDate} AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::date,
      'YYYY-MM-DD'
    )`;

    const rows = await this.db
      .select({
        week: weekSql,
        diagnosisId: soDiagnoses.id,
        name: soDiagnoses.name,
        cieCode: soDiagnoses.code,
        n: count(),
      })
      .from(soConsultationDiagnoses)
      .innerJoin(
        soConsultations,
        eq(soConsultationDiagnoses.consultationId, soConsultations.id),
      )
      .innerJoin(soDiagnoses, eq(soConsultationDiagnoses.diagnosisId, soDiagnoses.id))
      .where(and(this.rangeWhere(range), inArray(soDiagnoses.id, diagnosisIds)))
      .groupBy(weekSql, soDiagnoses.id, soDiagnoses.name, soDiagnoses.code)
      .orderBy(asc(weekSql));

    return rows.map((r) => ({
      week: r.week,
      diagnosisId: r.diagnosisId,
      name: r.name,
      cieCode: r.cieCode ?? null,
      n: Number(r.n),
    }));
  }

  private sapTxtDivMatchesDivision(divisionCode: string) {
    const key = divisionCode.trim().toUpperCase();
    const patterns = DIVISION_CODE_TO_PATTERNS[key] ?? [key];
    const uniq = [...new Set(patterns.map((p) => p.trim()).filter(Boolean))];
    const folded = sql<string>`translate(lower(COALESCE(${eiisTrabajadores.txtDiv}, '') || ' ' || COALESCE(${eiisTrabajadores.txtSubdiv}, '')), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')`;
    const clauses = uniq.map((raw) => {
      const needle = foldAscii(raw);
      if (!needle) return sql`FALSE`;
      const pattern = `%${needle}%`;
      return sql`${folded} LIKE ${pattern}`;
    });
    if (clauses.length === 0) return sql`FALSE`;
    return or(...clauses) ?? sql`FALSE`;
  }

  private sapSubdivisionFoldLike(subdivisionNeedle: string) {
    const needle = foldAscii(subdivisionNeedle.trim());
    if (!needle) return sql`FALSE`;
    const pattern = `%${needle}%`;
    const folded = sql<string>`translate(lower(COALESCE(${eiisTrabajadores.txtSubdiv}, '')), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')`;
    return sql`${folded} LIKE ${pattern}`;
  }

  /** Conteo de trabajadores activos en SAP (réplica), alineado a filtros del reporte. */
  async countActiveSapWorkers(
    divisionFragment?: string,
    subdivisionFragment?: string,
  ): Promise<number> {
    if (!this.sapDb) return 0;
    const parts = [eq(eiisTrabajadores.stat2, SAP_STAT_ACTIVO)];
    const d = divisionFragment?.trim();
    if (d) {
      parts.push(this.sapTxtDivMatchesDivision(d));
    }
    const s = subdivisionFragment?.trim();
    if (s) {
      parts.push(this.sapSubdivisionFoldLike(s));
    }
    const [row] = await this.sapDb
      .select({ n: countDistinct(eiisTrabajadores.pernr) })
      .from(eiisTrabajadores)
      .where(and(...parts));
    return Number(row?.n ?? 0);
  }

  /**
   * Atenciones por división (label SAP snapshot) y mes, para tasas.
   * Sin filtrar por `division` del UI en esta consulta interna (el spec pide evolución global salvo nota).
   */
  async monthlyByDivisionLabels(params: {
    anchor: Date;
    months: number;
    division?: string;
    subdivision?: string;
  }): Promise<
    { month: string; divisionLabel: string; consultationsCount: number }[]
  > {
    const { anchor, months, division, subdivision } = params;
    const start = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - (months - 1), 1),
    );
    const end = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );
    const range: SoReportDateRange = { from: start, to: end, division, subdivision };

    const rows = await this.db
      .select({
        month: sql<string>`TO_CHAR(${soConsultations.attentionDate} AT TIME ZONE 'UTC', 'YYYY-MM')`,
        divisionLabel: sql<string>`COALESCE(NULLIF(TRIM(${soConsultations.patientDivision}), ''), 'Sin división')`,
        n: count(),
      })
      .from(soConsultations)
      .where(this.rangeWhere(range))
      .groupBy(
        sql`TO_CHAR(${soConsultations.attentionDate} AT TIME ZONE 'UTC', 'YYYY-MM')`,
        sql`COALESCE(NULLIF(TRIM(${soConsultations.patientDivision}), ''), 'Sin división')`,
      )
      .orderBy(asc(sql`TO_CHAR(${soConsultations.attentionDate} AT TIME ZONE 'UTC', 'YYYY-MM')`));

    return rows.map((r) => ({
      month: r.month,
      divisionLabel: r.divisionLabel,
      consultationsCount: Number(r.n),
    }));
  }

  /** Conteos mensuales por par (diagnosisId) para un conjunto de IDs de diagnóstico. */
  async monthlyDiagnosisCountsForIds(params: {
    anchor: Date;
    months: number;
    diagnosisIds: string[];
    rangeForTop: SoReportDateRange;
  }): Promise<
    { month: string; diagnosisId: string; name: string; cieCode: string | null; n: number }[]
  > {
    const { anchor, months, diagnosisIds, rangeForTop } = params;
    if (diagnosisIds.length === 0) return [];

    const start = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - (months - 1), 1),
    );
    const end = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );
    const range: SoReportDateRange = {
      from: start,
      to: end,
      division: rangeForTop.division,
      subdivision: rangeForTop.subdivision,
    };

    const rows = await this.db
      .select({
        month: sql<string>`TO_CHAR(${soConsultations.attentionDate} AT TIME ZONE 'UTC', 'YYYY-MM')`,
        diagnosisId: soDiagnoses.id,
        name: soDiagnoses.name,
        cieCode: soDiagnoses.code,
        n: count(),
      })
      .from(soConsultationDiagnoses)
      .innerJoin(
        soConsultations,
        eq(soConsultationDiagnoses.consultationId, soConsultations.id),
      )
      .innerJoin(soDiagnoses, eq(soConsultationDiagnoses.diagnosisId, soDiagnoses.id))
      .where(
        and(this.rangeWhere(range), inArray(soDiagnoses.id, diagnosisIds)),
      )
      .groupBy(
        sql`TO_CHAR(${soConsultations.attentionDate} AT TIME ZONE 'UTC', 'YYYY-MM')`,
        soDiagnoses.id,
        soDiagnoses.name,
        soDiagnoses.code,
      )
      .orderBy(asc(sql`TO_CHAR(${soConsultations.attentionDate} AT TIME ZONE 'UTC', 'YYYY-MM')`));

    return rows.map((r) => ({
      month: r.month,
      diagnosisId: r.diagnosisId,
      name: r.name,
      cieCode: r.cieCode ?? null,
      n: Number(r.n),
    }));
  }

  /** Top diagnósticos en el periodo de filtros (para fijar leyenda chart 3). */
  async topDiagnosisIdsWithMeta(
    range: SoReportDateRange,
    limit: number,
  ): Promise<{ id: string; cieCode: string | null; name: string; totalCount: number }[]> {
    const rows = await this.db
      .select({
        id: soDiagnoses.id,
        cieCode: soDiagnoses.code,
        name: soDiagnoses.name,
        totalCount: count(),
      })
      .from(soConsultationDiagnoses)
      .innerJoin(
        soConsultations,
        eq(soConsultationDiagnoses.consultationId, soConsultations.id),
      )
      .innerJoin(soDiagnoses, eq(soConsultationDiagnoses.diagnosisId, soDiagnoses.id))
      .where(this.rangeWhere(range))
      .groupBy(soDiagnoses.id, soDiagnoses.code, soDiagnoses.name)
      .orderBy(desc(count()))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      cieCode: r.cieCode ?? null,
      name: r.name,
      totalCount: Number(r.totalCount),
    }));
  }

  /** Pacientes con más atenciones en el periodo (top “usuarios” atendidos). */
  async topPatients(
    range: SoReportDateRange,
    limit: number,
  ): Promise<
    { patientCod: string; patientName: string; consultationsCount: number }[]
  > {
    const baseWhere = and(
      this.rangeWhere(range),
      sql`TRIM(${soConsultations.patientCod}) <> ''`,
    );
    const rows = await this.db
      .select({
        patientCod: soConsultations.patientCod,
        patientName: sql<string>`MAX(${soConsultations.patientName})`,
        consultationsCount: sql<number>`COUNT(*)::int`,
      })
      .from(soConsultations)
      .where(baseWhere)
      .groupBy(soConsultations.patientCod)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit);
    return rows.map((r) => ({
      patientCod: r.patientCod,
      patientName: r.patientName,
      consultationsCount: Number(r.consultationsCount),
    }));
  }
}
