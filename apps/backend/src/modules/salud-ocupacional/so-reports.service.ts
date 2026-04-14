import { BadRequestException, Injectable } from '@nestjs/common';
import { PdfService, type PdfDocumentElement } from '@core/services/pdf.service';
import { createElement } from 'react';
import type { SoReportFiltersQuery } from './dto/so-reports.dto';
import {
  SoReportPdfDocument,
  type SoReportPdfPayload,
} from './pdf/SoReportPdfDocument';
import type { SoReportDateRange } from './so-reports.repository';
import { SoReportsRepository } from './so-reports.repository';

function parseIsoDate(s: string | undefined, label: string): Date | undefined {
  if (!s?.trim()) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException({ message: `${label} no es una fecha ISO válida` });
  }
  return d;
}

/** Rango por defecto: mes calendario actual (UTC) hasta ahora. */
export function defaultSoReportRange(): SoReportDateRange {
  const now = new Date();
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  return { from, to: now };
}

export function resolveSoReportRange(q: SoReportFiltersQuery): SoReportDateRange {
  const from = parseIsoDate(q.from, 'from') ?? defaultSoReportRange().from;
  const to = parseIsoDate(q.to, 'to') ?? defaultSoReportRange().to;
  if (from.getTime() > to.getTime()) {
    throw new BadRequestException({ message: 'from debe ser anterior o igual a to' });
  }
  return {
    from,
    to,
    division: q.division?.trim() || undefined,
    subdivision: q.subdivision?.trim() || undefined,
  };
}

function previousRange(range: SoReportDateRange): SoReportDateRange {
  const ms = range.to.getTime() - range.from.getTime();
  const prevTo = new Date(range.from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - ms);
  return { ...range, from: prevFrom, to: prevTo };
}

/** AR10, AR20, … si aparece en el texto de división SAP. */
function divisionSapHint(label: string): string | undefined {
  const m = label.match(/\b(AR\d{2})\b/);
  return m?.[1];
}

@Injectable()
export class SoReportsService {
  constructor(
    private readonly repo: SoReportsRepository,
    private readonly pdf: PdfService,
  ) {}

  async getSummary(q: SoReportFiltersQuery) {
    const range = resolveSoReportRange(q);
    const prev = previousRange(range);

    const [
      totalConsultations,
      totalConsultationsPrev,
      uniqueWorkers,
      reincidentWorkers,
      derivados,
      totalActiveWorkers,
    ] = await Promise.all([
      this.repo.countConsultations(range),
      this.repo.countConsultations(prev),
      this.repo.countDistinctPatients(range),
      this.repo.countReincidentPatients(range),
      this.repo.countDerivados(range),
      this.repo.countActiveSapWorkers(range.division, range.subdivision),
    ]);

    const reincidentRate =
      uniqueWorkers > 0 ? reincidentWorkers / uniqueWorkers : 0;
    const externalReferralRate =
      totalConsultations > 0 ? derivados / totalConsultations : 0;

    return {
      totalConsultations,
      totalConsultationsPrev,
      uniqueWorkers,
      totalActiveWorkers,
      reincidentWorkers,
      reincidentRate,
      externalReferrals: derivados,
      externalReferralRate,
    };
  }

  async getDischargeConditions(q: SoReportFiltersQuery) {
    const range = resolveSoReportRange(q);
    const rows = await this.repo.countByDischarge(range);
    const total = rows.reduce((s, r) => s + r.n, 0);
    return {
      conditions: rows.map((r) => ({
        condition: r.condition as 'recuperado' | 'observacion' | 'derivado',
        count: r.n,
        percentage: total > 0 ? (r.n / total) * 100 : 0,
      })),
    };
  }

  async getTopDiagnoses(q: SoReportFiltersQuery & { limit?: number }) {
    const range = resolveSoReportRange(q);
    const limit = q.limit ?? 5;
    const diagnoses = await this.repo.topDiagnoses(range, limit);
    return { diagnoses };
  }

  async getReportSubdivisions(q: SoReportFiltersQuery) {
    const range = resolveSoReportRange(q);
    const subdivisions = await this.repo.listSubdivisionsInRange({
      ...range,
      subdivision: undefined,
    });
    return { subdivisions };
  }

  async getByDivision(q: SoReportFiltersQuery) {
    const range = resolveSoReportRange(q);
    const rows = await this.repo.consultationsByDivision(range);
    const divisions = await Promise.all(
      rows.map(async (r) => {
        const hint = divisionSapHint(r.divisionLabel);
        const workersCount = await this.repo.countActiveSapWorkers(
          hint ?? (r.divisionLabel === 'Sin división' ? undefined : r.divisionLabel),
          range.subdivision,
        );
        return {
          divisionCode: hint ?? r.divisionLabel,
          divisionName: r.divisionLabel,
          workersCount,
          consultationsCount: r.consultationsCount,
        };
      }),
    );
    return { divisions };
  }

  async getTopMedications(q: SoReportFiltersQuery & { limit?: number }) {
    const range = resolveSoReportRange(q);
    const limit = q.limit ?? 5;
    const medications = await this.repo.topMedications(range, limit);
    return { medications };
  }

  async getTopPatients(q: SoReportFiltersQuery & { limit?: number }) {
    const range = resolveSoReportRange(q);
    const limit = q.limit ?? 5;
    const patients = await this.repo.topPatients(range, limit);
    return { patients };
  }

  async getTrend(q: SoReportFiltersQuery & { months?: number }) {
    const range = resolveSoReportRange(q);
    const months = q.months ?? 12;
    const anchor = range.to;

    const [monthly, rawDiv, topDiagMeta] = await Promise.all([
      this.repo.monthlyDischargeTrend({
        anchor,
        months,
        division: range.division,
        subdivision: range.subdivision,
      }),
      this.repo.monthlyByDivisionLabels({
        anchor,
        months,
        division: range.division,
        subdivision: range.subdivision,
      }),
      this.repo.topDiagnosisIdsWithMeta(range, 5),
    ]);

    const diagnosisIds = topDiagMeta.map((d) => d.id);
    const diagRows = await this.repo.monthlyDiagnosisCountsForIds({
      anchor,
      months,
      diagnosisIds,
      rangeForTop: range,
    });

    const divLabels = [...new Set(rawDiv.map((r) => r.divisionLabel))];
    const workersByLabel = new Map<string, number>();
    await Promise.all(
      divLabels.map(async (label) => {
        const hint = divisionSapHint(label);
        const n = await this.repo.countActiveSapWorkers(
          hint ?? (label === 'Sin división' ? undefined : label),
          range.subdivision,
        );
        workersByLabel.set(label, n);
      }),
    );

    const byDivisionMap = new Map<
      string,
      { code: string; count: number; workersCount: number; ratePer100: number }[]
    >();

    for (const r of rawDiv) {
      const wc = Math.max(1, workersByLabel.get(r.divisionLabel) ?? 1);
      const ratePer100 = (r.consultationsCount / wc) * 100;
      const code = divisionSapHint(r.divisionLabel) ?? r.divisionLabel;
      if (!byDivisionMap.has(r.month)) byDivisionMap.set(r.month, []);
      byDivisionMap.get(r.month)!.push({
        code,
        count: r.consultationsCount,
        workersCount: wc,
        ratePer100,
      });
    }

    const byDivision = [...byDivisionMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, divisions]) => ({ month, divisions }));

    const byDiagMap = new Map<
      string,
      { cieCode: string | null; name: string; count: number }[]
    >();

    for (const r of diagRows) {
      if (!byDiagMap.has(r.month)) byDiagMap.set(r.month, []);
      byDiagMap.get(r.month)!.push({
        cieCode: r.cieCode,
        name: r.name,
        count: r.n,
      });
    }

    const byDiagnosis = [...byDiagMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, diagnoses]) => ({ month, diagnoses }));

    return {
      monthly,
      byDivision,
      byDiagnosis,
      topDiagnoses: topDiagMeta.map((d) => ({
        cieCode: d.cieCode,
        name: d.name,
        totalCount: d.totalCount,
      })),
    };
  }

  /** PDF solo métricas (plantilla distinta a la ficha de consulta). */
  async renderPdf(q: SoReportFiltersQuery): Promise<Buffer> {
    const range = resolveSoReportRange(q);
    const [summary, discharge, topDiag, byDiv, topMed, topPat, trend] =
      await Promise.all([
        this.getSummary(q),
        this.getDischargeConditions(q),
        this.getTopDiagnoses({ ...q, limit: 10 }),
        this.getByDivision(q),
        this.getTopMedications({ ...q, limit: 10 }),
        this.getTopPatients({ ...q, limit: 10 }),
        this.getTrend({ ...q, months: 12 }),
      ]);

    const periodLabel = `${range.from.toISOString().slice(0, 10)} — ${range.to.toISOString().slice(0, 10)}`;
    const divisionLabel =
      [range.division?.trim(), range.subdivision?.trim()].filter(Boolean).join(' · ') ||
      'Todas';

    const deltaPct =
      summary.totalConsultationsPrev > 0
        ? (
            ((summary.totalConsultations - summary.totalConsultationsPrev) /
              summary.totalConsultationsPrev) *
            100
          ).toFixed(1)
        : '—';

    const kpis: SoReportPdfPayload['kpis'] = [
      { label: 'Atenciones (periodo)', value: String(summary.totalConsultations) },
      {
        label: 'Variación vs periodo anterior',
        value: `${deltaPct}%`,
      },
      { label: 'Trabajadores atendidos (distintos)', value: String(summary.uniqueWorkers) },
      {
        label: 'Trabajadores activos SAP (aprox.)',
        value: String(summary.totalActiveWorkers),
      },
      {
        label: 'Reincidencia (misma ventana de fechas)',
        value: `${(summary.reincidentRate * 100).toFixed(1)}%`,
      },
      {
        label: 'Derivaciones / tasa',
        value: `${summary.externalReferrals} (${(summary.externalReferralRate * 100).toFixed(1)}%)`,
      },
    ];

    const dischargeRows = discharge.conditions.map((c) => [
      c.condition,
      String(c.count),
      `${c.percentage.toFixed(1)}%`,
    ]);

    const diagRows = topDiag.diagnoses.map((d) => [d.name, String(d.count)]);

    const patientRows = topPat.patients.map((p) => [
      p.patientName,
      p.patientCod,
      String(p.consultationsCount),
    ]);

    const divRows = byDiv.divisions.map((d) => [
      d.divisionCode,
      d.divisionName,
      String(d.workersCount),
      String(d.consultationsCount),
    ]);

    const medRows = topMed.medications.map((m) => [
      m.name,
      String(m.prescriptionCount),
      String(m.totalUnits),
    ]);

    const trendRows = trend.monthly.map((m) => [
      m.month,
      String(m.total),
      String(m.recuperado),
      String(m.observacion),
      String(m.derivado),
    ]);

    const payload: SoReportPdfPayload = {
      periodLabel,
      divisionLabel,
      kpis,
      tables: [
        {
          title: 'Condición al alta',
          headers: ['Condición', 'Casos', '%'],
          rows: dischargeRows,
        },
        {
          title: 'Top diagnósticos',
          headers: ['Diagnóstico', 'Casos'],
          rows: diagRows,
        },
        {
          title: 'Top pacientes (más atenciones en el periodo)',
          headers: ['Nombre', 'Código', 'Atenciones'],
          rows: patientRows,
        },
        {
          title: 'Atenciones por división',
          headers: ['Código', 'División', 'Workers SAP', 'Atenciones'],
          rows: divRows,
        },
        {
          title: 'Medicamentos prescritos (top)',
          headers: ['Medicamento', 'Recetas', 'Unidades'],
          rows: medRows,
        },
        {
          title: 'Tendencia mensual (últimos 12 meses hacia fin de periodo)',
          headers: ['Mes', 'Total', 'Recuperado', 'Observación', 'Derivado'],
          rows: trendRows,
        },
      ],
    };

    return this.pdf.renderToBuffer(
      createElement(SoReportPdfDocument, {
        payload,
      }) as PdfDocumentElement,
    );
  }
}
