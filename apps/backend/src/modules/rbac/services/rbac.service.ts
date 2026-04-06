import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { SAMI_DB } from '@core/database/database.module';
import * as schema from '@core/database/schema';
import { rbacAppFeatures } from '@core/database/schema/rbac/app-features';
import { rbacApps } from '@core/database/schema/rbac/apps';
import { rbacRolePermissions } from '@core/database/schema/rbac/role-permissions';
import { rbacRoles } from '@core/database/schema/rbac/roles';
import { rbacWorkerRoleAssignments } from '@core/database/schema/rbac/worker-role-assignments';
import type {
  CachedAssignment,
  CachedPermissions,
} from '../types/rbac-cache.types';

const SUPERADMIN_SLUG = 'superadmin';

/** Si `role_permissions.actions` viene vacío o null, se usa como mínimo `read`. */
const DEFAULT_FEATURE_ACTIONS: string[] = ['read'];

@Injectable()
export class RbacService {
  constructor(
    @Inject(SAMI_DB)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  private activeAssignmentFilter() {
    return or(
      isNull(rbacWorkerRoleAssignments.expiresAt),
      gt(rbacWorkerRoleAssignments.expiresAt, new Date()),
    );
  }

  async resolvePermissions(workerId: string): Promise<CachedPermissions> {
    const [superHit] = await this.db
      .select({ id: rbacWorkerRoleAssignments.id })
      .from(rbacWorkerRoleAssignments)
      .innerJoin(rbacRoles, eq(rbacWorkerRoleAssignments.roleId, rbacRoles.id))
      .where(
        and(
          eq(rbacWorkerRoleAssignments.workerId, workerId),
          eq(rbacRoles.slug, SUPERADMIN_SLUG),
          this.activeAssignmentFilter(),
        ),
      )
      .limit(1);

    if (superHit) {
      return {
        workerId,
        isSuperadmin: true,
        managedModuleSlugs: [],
        assignments: [],
      };
    }

    const rows = await this.db
      .select({
        appSlug: rbacApps.slug,
        moduleSlug: rbacApps.moduleSlug,
        isManagement: rbacApps.isManagement,
        roleSlug: rbacRoles.slug,
        roleLevel: rbacRoles.level,
        featureSlug: rbacAppFeatures.slug,
        permissionActions: rbacRolePermissions.actions,
      })
      .from(rbacWorkerRoleAssignments)
      .innerJoin(rbacRoles, eq(rbacWorkerRoleAssignments.roleId, rbacRoles.id))
      .innerJoin(rbacApps, eq(rbacRoles.appId, rbacApps.id))
      .leftJoin(
        rbacRolePermissions,
        eq(rbacRolePermissions.roleId, rbacRoles.id),
      )
      .leftJoin(
        rbacAppFeatures,
        eq(rbacRolePermissions.featureId, rbacAppFeatures.id),
      )
      .where(
        and(
          eq(rbacWorkerRoleAssignments.workerId, workerId),
          this.activeAssignmentFilter(),
        ),
      );

    const assignmentMap = new Map<string, CachedAssignment>();
    const managedModuleSlugs = new Set<string>();

    for (const row of rows) {
      if (row.isManagement) {
        managedModuleSlugs.add(row.moduleSlug);
      }
      const key = `${row.appSlug}:${row.roleSlug}:global:`;
      if (!assignmentMap.has(key)) {
        assignmentMap.set(key, {
          appSlug: row.appSlug,
          moduleSlug: row.moduleSlug,
          roleSlug: row.roleSlug,
          roleLevel: row.roleLevel,
          scope: 'global',
          scopeId: null,
          permissions: {},
        });
      }
      const slug = row.featureSlug;
      if (!slug) continue;
      const entry = assignmentMap.get(key)!;
      const fromDb = row.permissionActions?.filter(Boolean) ?? [];
      const base =
        fromDb.length > 0 ? fromDb : DEFAULT_FEATURE_ACTIONS;
      const merged = new Set([...(entry.permissions[slug] ?? []), ...base]);
      entry.permissions[slug] = [...merged];
    }

    return {
      workerId,
      isSuperadmin: false,
      managedModuleSlugs: [...managedModuleSlugs],
      assignments: Array.from(assignmentMap.values()),
    };
  }

  /**
   * Comprueba si el worker puede ejecutar `action` sobre `featureSlug` en `appSlug`.
   * Si tiene asignación explícita con esa acción, permite. Si es **admin de módulo**
   * (`managedModuleSlugs` incluye el módulo de esa app), permite cualquier acción en apps de ese módulo.
   */
  async canAccess(
    cached: CachedPermissions,
    appSlug: string,
    featureSlug: string,
    action: string,
  ): Promise<boolean> {
    if (cached.isSuperadmin) {
      return true;
    }

    const managed = cached.managedModuleSlugs ?? [];

    const actions = new Set<string>();
    for (const a of cached.assignments) {
      if (a.appSlug !== appSlug) continue;
      for (const act of a.permissions[featureSlug] ?? []) {
        actions.add(act);
      }
    }
    if (actions.has(action)) {
      return true;
    }

    const [targetApp] = await this.db
      .select({ moduleSlug: rbacApps.moduleSlug })
      .from(rbacApps)
      .where(eq(rbacApps.slug, appSlug))
      .limit(1);
    if (!targetApp) {
      return false;
    }
    return managed.includes(targetApp.moduleSlug);
  }

  async getWorkerIdsByRole(roleId: string): Promise<string[]> {
    const rows = await this.db
      .select({ workerId: rbacWorkerRoleAssignments.workerId })
      .from(rbacWorkerRoleAssignments)
      .where(
        and(
          eq(rbacWorkerRoleAssignments.roleId, roleId),
          this.activeAssignmentFilter(),
        ),
      );
    return [...new Set(rows.map((r) => r.workerId))];
  }
}
