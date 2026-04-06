import { Inject, Injectable } from '@nestjs/common';
import { and, inArray, isNotNull, max, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { SAP_DB } from '@core/database/database.module';
import * as sapSchema from '@core/database/schema-sap';
import { eiisTrabajadores } from '@core/database/schema-sap/eiis-trabajadores';
import { ARIS_WORKFORCE_DIVISION_GROUPS } from './workforce-aris.constants';

/** Activo en réplica SAP (`stat2` puede venir como texto o número). */
function stat2ActivoCondition() {
  return or(
    sql`trim(${eiisTrabajadores.stat2}) = '3'`,
    sql`trim(${eiisTrabajadores.stat2}) = '03'`,
  );
}

export type WorkforceSubdivisionRowDto = {
  division_code: string;
  subdivision_code: string;
  name: string | null;
};

export type WorkforceOrgGroupDto = {
  slug: string;
  label: string;
  division_codes: string[];
  subdivisions: WorkforceSubdivisionRowDto[];
};

@Injectable()
export class WorkforceOrgCatalogService {
  constructor(@Inject(SAP_DB) private readonly sapDb: PostgresJsDatabase<typeof sapSchema> | null) {}

  async listArisGroupsWithSubdivisions(): Promise<{ groups: WorkforceOrgGroupDto[] }> {
    if (!this.sapDb) {
      return {
        groups: ARIS_WORKFORCE_DIVISION_GROUPS.map((g) => ({
          slug: g.slug,
          label: g.label,
          division_codes: [...g.werks],
          subdivisions: [],
        })),
      };
    }

    const out: WorkforceOrgGroupDto[] = [];

    for (const g of ARIS_WORKFORCE_DIVISION_GROUPS) {
      const werks = [...g.werks];
      const rows = await this.sapDb
        .select({
          werks: eiisTrabajadores.werks,
          btrtl: eiisTrabajadores.btrtl,
          nombre: max(eiisTrabajadores.txtSubdiv),
        })
        .from(eiisTrabajadores)
        .where(
          and(
            stat2ActivoCondition(),
            inArray(eiisTrabajadores.werks, werks),
            isNotNull(eiisTrabajadores.btrtl),
            sql`trim(${eiisTrabajadores.btrtl}) <> ''`,
          ),
        )
        .groupBy(eiisTrabajadores.werks, eiisTrabajadores.btrtl);

      const subdivisions: WorkforceSubdivisionRowDto[] = rows
        .map((r) => ({
          division_code: (r.werks ?? '').trim(),
          subdivision_code: (r.btrtl ?? '').trim(),
          name: r.nombre?.trim() || null,
        }))
        .filter((r) => r.division_code && r.subdivision_code)
        .sort((a, b) =>
          (a.name ?? a.subdivision_code).localeCompare(b.name ?? b.subdivision_code, 'es'),
        );

      out.push({
        slug: g.slug,
        label: g.label,
        division_codes: werks,
        subdivisions,
      });
    }

    return { groups: out };
  }
}
