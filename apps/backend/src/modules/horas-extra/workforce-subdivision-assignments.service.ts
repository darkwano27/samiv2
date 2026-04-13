import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { SAMI_DB } from '@core/database/database.module';
import * as schema from '@core/database/schema';
import { workforceSubdivisionRoleAssignees } from '@core/database/schema/workforce-subdivision-assignees';
import { workers } from '@core/database/schema/workers';
import { AdminService } from '@modules/rbac/services/admin.service';
import type { PatchSubdivisionAssignmentsBody } from './dto/workforce-assignments.dto';
import {
  ARIS_WORKFORCE_DIVISION_GROUPS,
  MODULE_SLUG_HORAS_EXTRA,
  WORKFORCE_PROFILE_APROBADOR_HE,
  WORKFORCE_PROFILE_SUPERVISOR_HE,
} from './workforce-aris.constants';
import { WorkforceOrgCatalogService } from './workforce-org-catalog.service';

const ALLOWED_WERKS: Set<string> = new Set(
  ARIS_WORKFORCE_DIVISION_GROUPS.flatMap((g) => [...g.werks]),
);

export type AssigneeRowDto = {
  division_code: string;
  subdivision_code: string;
  role: 'supervisor' | 'approver';
  worker_id: string;
  worker_name: string | null;
};

@Injectable()
export class WorkforceSubdivisionAssignmentsService {
  constructor(
    @Inject(SAMI_DB) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly catalog: WorkforceOrgCatalogService,
    private readonly admin: AdminService,
  ) {}

  private async assertKnownSubdivision(divisionCode: string, subdivisionCode: string): Promise<void> {
    const div = divisionCode.trim();
    const sub = subdivisionCode.trim();
    if (!div || !sub || !ALLOWED_WERKS.has(div)) {
      throw new BadRequestException({
        message: 'Código de división o subdivisión no válido para WorkForce.',
      });
    }
    const { groups } = await this.catalog.listArisGroupsWithSubdivisions();
    const anySap = groups.some((g) => g.subdivisions.length > 0);
    if (!anySap) {
      return;
    }
    const ok = groups.some((g) =>
      g.subdivisions.some((s) => s.division_code === div && s.subdivision_code === sub),
    );
    if (!ok) {
      throw new BadRequestException({
        message: 'La subdivisión no figura en el directorio SAP para las divisiones ARIS.',
      });
    }
  }

  async listAll(): Promise<{ items: AssigneeRowDto[] }> {
    const rows = await this.db
      .select({
        divisionCode: workforceSubdivisionRoleAssignees.divisionCode,
        subdivisionCode: workforceSubdivisionRoleAssignees.subdivisionCode,
        role: workforceSubdivisionRoleAssignees.role,
        workerId: workforceSubdivisionRoleAssignees.workerId,
        workerName: workers.name,
      })
      .from(workforceSubdivisionRoleAssignees)
      .innerJoin(workers, eq(workforceSubdivisionRoleAssignees.workerId, workers.id));

    return {
      items: rows.map((r) => {
        const raw = (r.role ?? '').trim();
        const roleForApi: 'supervisor' | 'approver' =
          raw === 'supervisor' ? 'supervisor' : 'approver';
        return {
          division_code: r.divisionCode,
          subdivision_code: r.subdivisionCode,
          role: roleForApi,
          worker_id: r.workerId,
          worker_name: r.workerName,
        };
      }),
    };
  }

  async replaceForSubdivision(body: PatchSubdivisionAssignmentsBody): Promise<{ ok: true }> {
    const division = body.division_code.trim();
    const subdivision = body.subdivision_code.trim();
    await this.assertKnownSubdivision(division, subdivision);

    const sup = [...new Set(body.supervisor_worker_ids.map((x) => x.trim()).filter(Boolean))];
    const app = [...new Set(body.approver_worker_ids.map((x) => x.trim()).filter(Boolean))];
    await this.admin.ensureWorkersForSapCodes([...sup, ...app]);

    await this.db.transaction(async (tx) => {
      await tx
        .delete(workforceSubdivisionRoleAssignees)
        .where(
          and(
            eq(workforceSubdivisionRoleAssignees.divisionCode, division),
            eq(workforceSubdivisionRoleAssignees.subdivisionCode, subdivision),
          ),
        );

      if (sup.length) {
        await tx.insert(workforceSubdivisionRoleAssignees).values(
          sup.map((workerId) => ({
            divisionCode: division,
            subdivisionCode: subdivision,
            role: 'supervisor',
            workerId,
          })),
        );
      }
      if (app.length) {
        await tx.insert(workforceSubdivisionRoleAssignees).values(
          app.map((workerId) => ({
            divisionCode: division,
            subdivisionCode: subdivision,
            /** Mismo valor que usa `AprobacionHorasExtraService` (`aprobador`), no el inglés `approver`. */
            role: 'aprobador',
            workerId,
          })),
        );
      }
    });

    const approverSet = new Set(app);
    for (const workerSap of app) {
      await this.admin.applyModuleProfile(
        workerSap,
        WORKFORCE_PROFILE_APROBADOR_HE,
        MODULE_SLUG_HORAS_EXTRA,
      );
    }
    for (const workerSap of sup) {
      if (!approverSet.has(workerSap)) {
        await this.admin.applyModuleProfile(
          workerSap,
          WORKFORCE_PROFILE_SUPERVISOR_HE,
          MODULE_SLUG_HORAS_EXTRA,
        );
      }
    }

    return { ok: true as const };
  }
}
