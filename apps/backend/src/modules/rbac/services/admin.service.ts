import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, asc, count, eq, ilike, inArray, isNull, ne, or } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { SAMI_DB, SAP_DB } from '@core/database/database.module';
import * as schema from '@core/database/schema';
import * as sapSchema from '@core/database/schema-sap';
import { eiisTrabajadores } from '@core/database/schema-sap/eiis-trabajadores';
import { localAuth } from '@core/database/schema/local-auth';
import { workers } from '@core/database/schema/workers';
import { rbacAppFeatures } from '@core/database/schema/rbac/app-features';
import { rbacApps } from '@core/database/schema/rbac/apps';
import { rbacDefaultRoleAssignments } from '@core/database/schema/rbac/default-role-assignments';
import { rbacModuleProfiles } from '@core/database/schema/rbac/module-profiles';
import { rbacRolePermissions } from '@core/database/schema/rbac/role-permissions';
import { rbacRoles } from '@core/database/schema/rbac/roles';
import { rbacWorkerRoleAssignments } from '@core/database/schema/rbac/worker-role-assignments';
import type { AssignWorkerRoleBody } from '../dto/admin.schemas';
import { PermissionCacheService } from './permission-cache.service';

const SAP_STAT_ACTIVO = 3;

/** Etiquetas de módulo alineadas a la navegación (sidebar). */
const MODULE_LABEL: Record<string, string> = {
  'salud-ocupacional': 'Salud ocupacional',
  'horas-extra': 'Horas extra',
  visitas: 'Visitas',
  'crm-quimicos': 'CRM Químicos',
  sistemas: 'Sistemas',
  administracion: 'Administración',
  platform: 'Plataforma',
  consultas: 'Consultas',
  equipos: 'Equipos',
};

function moduleDisplayLabel(slug: string, fallbackLabel: string): string {
  return MODULE_LABEL[slug] ?? fallbackLabel;
}

/** Misma prioridad que `inferPrimaryProfile` en `SoAjustesView.tsx` (perfil “visible” en cards). */
function inferSoPrimaryProfileFromRoleSlugs(
  roleSlugs: Set<string>,
): 'enfermera' | 'jefe-so' | null {
  if (roleSlugs.has('module-admin')) return 'jefe-so';
  if (roleSlugs.has('enfermera')) return 'enfermera';
  if (roleSlugs.has('jefe-so')) return 'jefe-so';
  return null;
}

/** Pista de chip en listado de miembros cuando no hay `applied_profile` único. */
function inferPrimaryProfileSlugForMemberRow(
  moduleSlug: string,
  roleSlugs: Set<string>,
): string | null {
  if (moduleSlug === 'salud-ocupacional') {
    return inferSoPrimaryProfileFromRoleSlugs(roleSlugs);
  }
  if (moduleSlug === 'sistemas' && roleSlugs.has('module-admin')) {
    return 'admin-sistemas';
  }
  return null;
}

/** Perfiles semilla SO (seed:rbac); no se eliminan por API; roles congelados en edición. */
const SO_SEED_PROFILE_SLUGS = new Set(['enfermera', 'jefe-so']);

/** Perfiles semilla Sistemas (seed:rbac). */
const SISTEMAS_SEED_PROFILE_SLUGS = new Set([
  'soporte',
  'aplicaciones',
  'infraestructura',
  'admin-sistemas',
]);

function isModuleSeedProfile(moduleSlug: string, profileSlug: string): boolean {
  if (moduleSlug === 'salud-ocupacional') {
    return SO_SEED_PROFILE_SLUGS.has(profileSlug);
  }
  if (moduleSlug === 'sistemas') {
    return SISTEMAS_SEED_PROFILE_SLUGS.has(profileSlug);
  }
  return false;
}

function slugifySoProfileLabel(label: string): string {
  const s = label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || 'perfil';
}

/** Orden de acciones en catálogo UI y respuestas de perfil. */
const SO_PROFILE_ACTION_ORDER = ['read', 'create', 'update', 'delete'] as const;

function sortSoProfileActions(actions: Iterable<string>): string[] {
  const set = new Set(actions);
  const out: string[] = [];
  for (const a of SO_PROFILE_ACTION_ORDER) {
    if (set.has(a)) out.push(a);
  }
  const orderSet = new Set<string>(SO_PROFILE_ACTION_ORDER);
  const rest = [...set].filter((x) => !orderSet.has(x));
  rest.sort((a, b) => a.localeCompare(b, 'es'));
  return [...out, ...rest];
}

/**
 * Acciones ofrecidas en el modal de perfil SO (fuente de verdad de producto).
 * Historial: sin `create`. Inventario: CRUD completo. Registro: lectura + creación.
 */
const SO_PROFILE_ACTIONS_BY_APP_SLUG: Record<string, readonly string[]> = {
  'historial-medico': ['read', 'update', 'delete'],
  'inventario-medico': ['read', 'create', 'update', 'delete'],
  'mis-consultas': ['read'],
  'registro-consulta': ['read', 'create'],
  'reportes-so': ['read'],
};

/** Acciones de producto por app — módulo Sistemas (modal perfiles / apply-profile). */
const SISTEMAS_PROFILE_ACTIONS_BY_APP_SLUG: Record<string, readonly string[]> = {
  'asignacion-bienes': ['read', 'create', 'update', 'delete'],
  'registro-productividad': ['read', 'create', 'update', 'delete'],
  'mis-equipos': ['read', 'create', 'update', 'delete'],
};

/** Texto corto para el modal de perfil (según acciones de producto por app). */
function actionScopeNoteForAvailableActions(actions: readonly string[]): string | undefined {
  const sorted = [...new Set(actions)].sort().join(',');
  if (sorted === 'read,create') {
    return 'Esta aplicación solo permite marcar lectura y creación en el perfil.';
  }
  if (sorted === 'read,create,update') {
    return 'Incluye lectura, creación y edición en el perfil.';
  }
  if (sorted === 'read') {
    return 'Esta aplicación solo permite marcar lectura en el perfil.';
  }
  if (sorted === 'read,update,delete') {
    return 'Incluye lectura, edición y eliminación (no hay creación en esta app).';
  }
  if (sorted === 'read,create,update,delete') {
    return 'Puedes combinar lectura, creación, edición y eliminación.';
  }
  return undefined;
}

function normalizeStoredAppPermissionsJson(
  raw: unknown,
): { app_slug: string; actions: string[] }[] | null {
  if (!raw || !Array.isArray(raw)) return null;
  const out: { app_slug: string; actions: string[] }[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const app_slug = String((row as { app_slug?: unknown }).app_slug ?? '').trim();
    const acts = (row as { actions?: unknown }).actions;
    if (!app_slug || !Array.isArray(acts)) continue;
    const actions = sortSoProfileActions(acts.map((a) => String(a).trim()).filter(Boolean));
    if (actions.length === 0) continue;
    out.push({ app_slug, actions });
  }
  out.sort((a, b) => a.app_slug.localeCompare(b.app_slug, 'es'));
  return out.length ? out : null;
}

function isTrabajadorActivoStat(stat2: string | null | undefined): boolean {
  const n = Number(String(stat2 ?? '').trim());
  return n === SAP_STAT_ACTIVO;
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

/** Nombre para mostrar desde staging (vorna + apellidos; incluye apellido materno si existe `name2`). */
function formatStagingWorkerName(
  vorna: string | null | undefined,
  nachn: string | null | undefined,
  name2?: string | null | undefined,
): string {
  return [vorna, nachn, name2]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

export type WorkerDirectoryRow = {
  sap_code: string;
  nombre: string;
  apellido: string;
  /** `ad` si tiene correo corporativo (AD); `local` si no, pero ya tiene fila en `local_auth`. */
  access: 'ad' | 'local';
  /** `activo`: AD o local registrado; `pendiente`: sin AD ni `local_auth` (flujo new-local). */
  status: 'activo' | 'pendiente';
  /** Solo cuentas con `local_auth`: bloqueada por intentos fallidos hasta `locked_until` o desbloqueo admin. */
  local_account_locked: boolean;
};

@Injectable()
export class AdminService {
  constructor(
    @Inject(SAMI_DB)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @Optional()
    @Inject(SAP_DB)
    private readonly sapDb: PostgresJsDatabase<typeof sapSchema> | null,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  /**
   * Resuelve nombre legible desde SAP staging para códigos `pernr` (activos, registro vigente).
   */
  private async resolveSapWorkerDisplayNames(
    sapCodes: string[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const codes = [...new Set(sapCodes.map((c) => c.trim()).filter(Boolean))];
    if (!this.sapDb || codes.length === 0) {
      return out;
    }

    const rows = await this.sapDb
      .select()
      .from(eiisTrabajadores)
      .where(inArray(eiisTrabajadores.pernr, codes));

    const byPernr = new Map<string, (typeof rows)[0]>();
    for (const row of rows) {
      if (!isTrabajadorActivoStat(row.stat2)) continue;
      const key = row.pernr.trim();
      if (!codes.includes(key)) continue;
      const prev = byPernr.get(key);
      if (!prev || compareStagingRows(row, prev) > 0) {
        byPernr.set(key, row);
      }
    }

    for (const code of codes) {
      const w = byPernr.get(code);
      if (!w) continue;
      const full = formatStagingWorkerName(w.vorna, w.nachn, w.name2);
      if (full) {
        out.set(code, full);
      }
    }
    return out;
  }

  /**
   * Elimina una asignación manual de rol e invalida caché RBAC del worker.
   */
  async revokeAssignment(assignmentId: string) {
    const id = assignmentId.trim();
    const [row] = await this.db
      .select({
        id: rbacWorkerRoleAssignments.id,
        workerId: rbacWorkerRoleAssignments.workerId,
      })
      .from(rbacWorkerRoleAssignments)
      .where(eq(rbacWorkerRoleAssignments.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException({ message: 'Asignación no encontrada' });
    }

    await this.db
      .delete(rbacWorkerRoleAssignments)
      .where(eq(rbacWorkerRoleAssignments.id, id));

    await this.permissionCache.invalidate(row.workerId);

    return { revoked: true as const, assignment_id: id };
  }

  /**
   * Directorio de trabajadores activos (SAP staging) + estado de acceso SAMI.
   * Alineado a `identify` / `login` en `AuthService` (correo_corp ⇒ AD; si no, `local_auth`).
   */
  async listWorkersDirectory(): Promise<{ workers: WorkerDirectoryRow[] }> {
    if (!this.sapDb) {
      throw new ServiceUnavailableException({
        message: 'SAP staging no disponible',
      });
    }

    const stagingRows = await this.sapDb.select().from(eiisTrabajadores);
    const byPernr = new Map<string, (typeof stagingRows)[0]>();
    for (const row of stagingRows) {
      if (!isTrabajadorActivoStat(row.stat2)) continue;
      const key = row.pernr.trim();
      if (!key) continue;
      const prev = byPernr.get(key);
      if (!prev || compareStagingRows(row, prev) > 0) {
        byPernr.set(key, row);
      }
    }

    const sapCodes = [...byPernr.keys()];
    if (sapCodes.length === 0) {
      return { workers: [] };
    }

    const localRows = await this.db
      .select({
        sapCode: localAuth.sapCode,
        lockedUntil: localAuth.lockedUntil,
      })
      .from(localAuth)
      .where(inArray(localAuth.sapCode, sapCodes));
    const localBySap = new Map(localRows.map((r) => [r.sapCode, r]));

    const nowMs = Date.now();
    const workersList: WorkerDirectoryRow[] = sapCodes
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((sapCode) => {
        const w = byPernr.get(sapCode)!;
        const correoCorp = w.correoCorp?.trim();
        const isAd = Boolean(correoCorp);
        const localRow = localBySap.get(sapCode);
        const registeredLocal = localRow !== undefined;
        const lockedUntil = localRow?.lockedUntil
          ? new Date(localRow.lockedUntil).getTime()
          : null;
        const localAccountLocked = Boolean(
          registeredLocal && lockedUntil !== null && lockedUntil > nowMs,
        );

        const access: WorkerDirectoryRow['access'] = isAd ? 'ad' : 'local';
        const status: WorkerDirectoryRow['status'] =
          isAd || registeredLocal ? 'activo' : 'pendiente';

        return {
          sap_code: sapCode,
          nombre: (w.vorna ?? '').trim(),
          apellido: (w.nachn ?? '').trim(),
          access,
          status,
          local_account_locked: localAccountLocked,
        };
      });

    return { workers: workersList };
  }

  /**
   * Quita bloqueo por intentos fallidos en cuenta local (`local_auth`).
   */
  async unlockLocalAccount(sapCode: string) {
    const code = sapCode.trim();
    const [row] = await this.db
      .select({ sapCode: localAuth.sapCode })
      .from(localAuth)
      .where(eq(localAuth.sapCode, code))
      .limit(1);
    if (!row) {
      throw new NotFoundException({
        message: 'Este trabajador no tiene cuenta local',
      });
    }

    await this.db
      .update(localAuth)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(localAuth.sapCode, code));

    return { sap_code: code, unlocked: true as const };
  }

  /**
   * Resumen por módulo RBAC: cantidad de apps, admins (`module-admin` en app de gestión),
   * y conteo de workers distintos por rol (asignaciones manuales en apps del módulo).
   */
  async listModulesSummary(): Promise<{
    modules: {
      module_slug: string;
      module_label: string;
      app_count: number;
      admins: {
        sap_code: string;
        name: string;
        scope: string;
        assignment_id: string;
      }[];
      role_summary: { role_slug: string; role_label: string; worker_count: number }[];
      total_workers_with_roles: number;
    }[];
  }> {
    const allApps = await this.db
      .select({
        id: rbacApps.id,
        slug: rbacApps.slug,
        module_slug: rbacApps.moduleSlug,
        label: rbacApps.label,
      })
      .from(rbacApps)
      .where(ne(rbacApps.moduleSlug, 'platform'));

    const byModule = new Map<
      string,
      { apps: typeof allApps; label: string }
    >();
    for (const a of allApps) {
      const key = a.module_slug;
      if (!byModule.has(key)) {
        byModule.set(key, { apps: [], label: a.label });
      }
      const entry = byModule.get(key)!;
      entry.apps.push(a);
      if ((a.label?.length ?? 0) > entry.label.length) {
        entry.label = a.label;
      }
    }

    const moduleSlugs = [...byModule.keys()];
    if (moduleSlugs.length === 0) {
      return { modules: [] };
    }

    const assignmentRows = await this.db
      .select({
        worker_id: rbacWorkerRoleAssignments.workerId,
        role_slug: rbacRoles.slug,
        role_label: rbacRoles.label,
        module_slug: rbacApps.moduleSlug,
        is_management: rbacApps.isManagement,
      })
      .from(rbacWorkerRoleAssignments)
      .innerJoin(rbacRoles, eq(rbacWorkerRoleAssignments.roleId, rbacRoles.id))
      .innerJoin(rbacApps, eq(rbacRoles.appId, rbacApps.id))
      .where(inArray(rbacApps.moduleSlug, moduleSlugs));

    const adminRows = await this.db
      .select({
        assignment_id: rbacWorkerRoleAssignments.id,
        worker_id: workers.id,
        fallback_name: workers.name,
        module_slug: rbacApps.moduleSlug,
      })
      .from(rbacWorkerRoleAssignments)
      .innerJoin(rbacRoles, eq(rbacWorkerRoleAssignments.roleId, rbacRoles.id))
      .innerJoin(rbacApps, eq(rbacRoles.appId, rbacApps.id))
      .innerJoin(workers, eq(workers.id, rbacWorkerRoleAssignments.workerId))
      .where(
        and(
          eq(rbacRoles.slug, 'module-admin'),
          eq(rbacApps.isManagement, true),
          inArray(rbacApps.moduleSlug, moduleSlugs),
        ),
      );

    const sapNames = await this.resolveSapWorkerDisplayNames(
      adminRows.map((r) => r.worker_id),
    );

    const adminsByModule = new Map<
      string,
      Map<string, { assignment_id: string; name: string }>
    >();
    for (const r of adminRows) {
      const code = r.worker_id.trim();
      if (!adminsByModule.has(r.module_slug)) {
        adminsByModule.set(r.module_slug, new Map());
      }
      const map = adminsByModule.get(r.module_slug)!;
      if (map.has(code)) continue;
      const fromSap = sapNames.get(code);
      map.set(code, {
        assignment_id: r.assignment_id,
        name: fromSap && fromSap.length > 0 ? fromSap : r.fallback_name,
      });
    }

    const modules = moduleSlugs.sort((a, b) => a.localeCompare(b, 'es')).map((slug) => {
      const meta = byModule.get(slug)!;
      const app_count = meta.apps.length;
      const module_label = moduleDisplayLabel(slug, meta.label);

      const adminMap = adminsByModule.get(slug) ?? new Map();
      const admins = [...adminMap.entries()].map(([sap_code, v]) => ({
        sap_code,
        name: v.name,
        scope: 'Global',
        assignment_id: String(v.assignment_id),
      }));

      const roleMap = new Map<
        string,
        { label: string; workers: Set<string> }
      >();
      const allWorkersInModule = new Set<string>();
      for (const row of assignmentRows) {
        if (row.module_slug !== slug) continue;
        allWorkersInModule.add(row.worker_id);
        if (!roleMap.has(row.role_slug)) {
          roleMap.set(row.role_slug, {
            label: row.role_label,
            workers: new Set(),
          });
        }
        roleMap.get(row.role_slug)!.workers.add(row.worker_id);
      }

      const role_summary = [...roleMap.entries()]
        .map(([role_slug, v]) => ({
          role_slug,
          role_label: v.label,
          worker_count: v.workers.size,
        }))
        .sort((a, b) => a.role_label.localeCompare(b.role_label, 'es'));

      return {
        module_slug: slug,
        module_label,
        app_count,
        admins,
        role_summary,
        total_workers_with_roles: allWorkersInModule.size,
      };
    });

    return { modules };
  }

  async getRbacCatalog() {
    const apps = await this.db
      .select({
        id: rbacApps.id,
        slug: rbacApps.slug,
        module_slug: rbacApps.moduleSlug,
        label: rbacApps.label,
        is_management: rbacApps.isManagement,
      })
      .from(rbacApps);

    const roles = await this.db
      .select({
        id: rbacRoles.id,
        app_id: rbacRoles.appId,
        slug: rbacRoles.slug,
        label: rbacRoles.label,
        level: rbacRoles.level,
      })
      .from(rbacRoles);

    const features = await this.db
      .select({
        id: rbacAppFeatures.id,
        app_id: rbacAppFeatures.appId,
        slug: rbacAppFeatures.slug,
        label: rbacAppFeatures.label,
      })
      .from(rbacAppFeatures);

    return { apps, roles, features };
  }

  /** Catálogo RBAC filtrado a un `module_slug` (p. ej. administradores de módulo). */
  async getRbacCatalogForModule(moduleSlug: string) {
    const full = await this.getRbacCatalog();
    const apps = full.apps.filter((a) => a.module_slug === moduleSlug);
    const appIds = new Set(apps.map((a) => a.id));
    const roles = full.roles.filter((r) => appIds.has(r.app_id));
    const features = full.features.filter((f) => appIds.has(f.app_id));
    return { apps, roles, features };
  }

  /**
   * Catálogo para el modal Crear/Editar perfil SO: por app, lista de acciones de producto
   * (`SO_PROFILE_ACTIONS_BY_APP_SLUG`); el backend elige el rol que mejor cubre.
   */
  async getSoProfileActionCatalogForModule(moduleSlug: string) {
    const appRows = await this.db
      .select({
        id: rbacApps.id,
        slug: rbacApps.slug,
        label: rbacApps.label,
        isManagement: rbacApps.isManagement,
      })
      .from(rbacApps)
      .where(eq(rbacApps.moduleSlug, moduleSlug))
      .orderBy(asc(rbacApps.label));

    const appsOut: {
      slug: string;
      label: string;
      is_management: boolean;
      available_actions: string[];
      management_note?: string;
    }[] = [];

    for (const app of appRows) {
      const roleIdsRows = await this.db
        .select({ id: rbacRoles.id })
        .from(rbacRoles)
        .where(eq(rbacRoles.appId, app.id));
      const roleIds = roleIdsRows.map((r) => r.id);

      const union = new Set<string>();
      if (roleIds.length > 0) {
        const permRows = await this.db
          .select({ actions: rbacRolePermissions.actions })
          .from(rbacRolePermissions)
          .where(inArray(rbacRolePermissions.roleId, roleIds));
        for (const row of permRows) {
          for (const a of row.actions ?? ['read']) {
            union.add(a);
          }
        }
      }

      const productActions =
        moduleSlug === 'salud-ocupacional'
          ? SO_PROFILE_ACTIONS_BY_APP_SLUG[app.slug]
          : moduleSlug === 'sistemas'
            ? SISTEMAS_PROFILE_ACTIONS_BY_APP_SLUG[app.slug]
            : undefined;
      const available_actions = productActions
        ? sortSoProfileActions(productActions)
        : sortSoProfileActions(union);

      if (app.isManagement) {
        appsOut.push({
          slug: app.slug,
          label: app.label,
          is_management: true,
          available_actions: sortSoProfileActions(union),
          management_note:
            'Solo un superadmin puede otorgar la administración del módulo (no se incluye en perfiles de esta pantalla).',
        });
      } else {
        const action_scope_note =
          actionScopeNoteForAvailableActions(available_actions);
        appsOut.push({
          slug: app.slug,
          label: app.label,
          is_management: false,
          available_actions,
          ...(action_scope_note ? { action_scope_note } : {}),
        });
      }
    }

    return { apps: appsOut };
  }

  async listWorkerAssignments(workerId: string) {
    const rows = await this.db
      .select({
        id: rbacWorkerRoleAssignments.id,
        worker_id: rbacWorkerRoleAssignments.workerId,
        role_id: rbacWorkerRoleAssignments.roleId,
        created_at: rbacWorkerRoleAssignments.createdAt,
        expires_at: rbacWorkerRoleAssignments.expiresAt,
        role_slug: rbacRoles.slug,
        app_slug: rbacApps.slug,
        module_slug: rbacApps.moduleSlug,
      })
      .from(rbacWorkerRoleAssignments)
      .innerJoin(rbacRoles, eq(rbacWorkerRoleAssignments.roleId, rbacRoles.id))
      .innerJoin(rbacApps, eq(rbacRoles.appId, rbacApps.id))
      .where(eq(rbacWorkerRoleAssignments.workerId, workerId));

    return { worker_id: workerId, assignments: rows };
  }

  async listWorkerAssignmentsInModule(workerId: string, moduleSlug: string) {
    const full = await this.listWorkerAssignments(workerId);
    const assignments = full.assignments.filter(
      (a) => a.module_slug === moduleSlug,
    );
    return { worker_id: workerId, assignments };
  }

  /**
   * Asigna rol solo si el rol pertenece a una app del módulo indicado.
   */
  async assignWorkerRoleInModule(
    body: AssignWorkerRoleBody,
    moduleSlug: string,
  ) {
    const [roleRow] = await this.db
      .select({ appModule: rbacApps.moduleSlug })
      .from(rbacRoles)
      .innerJoin(rbacApps, eq(rbacRoles.appId, rbacApps.id))
      .where(eq(rbacRoles.id, body.role_id))
      .limit(1);
    if (!roleRow) {
      throw new NotFoundException({ message: 'Rol no encontrado' });
    }
    if (roleRow.appModule !== moduleSlug) {
      throw new ForbiddenException({
        message: 'Este rol no pertenece al módulo indicado',
      });
    }
    return this.assignWorkerRole(body);
  }

  /**
   * Revoca asignación solo si el rol asociado es de una app del módulo indicado.
   */
  async revokeAssignmentInModule(assignmentId: string, moduleSlug: string) {
    const id = assignmentId.trim();
    const [row] = await this.db
      .select({
        id: rbacWorkerRoleAssignments.id,
        workerId: rbacWorkerRoleAssignments.workerId,
        mod: rbacApps.moduleSlug,
      })
      .from(rbacWorkerRoleAssignments)
      .innerJoin(rbacRoles, eq(rbacWorkerRoleAssignments.roleId, rbacRoles.id))
      .innerJoin(rbacApps, eq(rbacRoles.appId, rbacApps.id))
      .where(eq(rbacWorkerRoleAssignments.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException({ message: 'Asignación no encontrada' });
    }
    if (row.mod !== moduleSlug) {
      throw new ForbiddenException({
        message: 'La asignación no pertenece al módulo indicado',
      });
    }

    await this.db
      .delete(rbacWorkerRoleAssignments)
      .where(eq(rbacWorkerRoleAssignments.id, id));

    await this.permissionCache.invalidate(row.workerId);

    return { revoked: true as const, assignment_id: id };
  }

  /**
   * Elimina todas las asignaciones RBAC del worker en apps del módulo (alcance por `role_id` ∈ roles del módulo).
   */
  async revokeAllAssignmentsInModule(workerIdRaw: string, moduleSlug: string) {
    const workerId = workerIdRaw.trim();
    const roleRows = await this.db
      .select({ id: rbacRoles.id })
      .from(rbacRoles)
      .innerJoin(rbacApps, eq(rbacRoles.appId, rbacApps.id))
      .where(eq(rbacApps.moduleSlug, moduleSlug));

    const roleIds = roleRows.map((r) => r.id);
    if (roleIds.length === 0) {
      return { revoked: 0 };
    }

    const deleted = await this.db
      .delete(rbacWorkerRoleAssignments)
      .where(
        and(
          eq(rbacWorkerRoleAssignments.workerId, workerId),
          inArray(rbacWorkerRoleAssignments.roleId, roleIds),
        ),
      )
      .returning({ id: rbacWorkerRoleAssignments.id });

    if (deleted.length > 0) {
      await this.permissionCache.invalidate(workerId);
    }

    return { revoked: deleted.length };
  }

  /**
   * Revoca todos los roles del módulo y aplica el perfil semilla (mismos roles que `apply-profile`).
   */
  async replaceModuleProfile(
    workerSap: string,
    profileSlug: string,
    moduleSlug: string,
  ) {
    await this.revokeAllAssignmentsInModule(workerSap, moduleSlug);
    return this.applyModuleProfile(workerSap, profileSlug, moduleSlug);
  }

  /**
   * Detalle de un miembro del módulo: apps con acceso (rol + features/acciones) y apps sin acceso.
   */
  async getMemberDetailForModule(workerIdRaw: string, moduleSlug: string) {
    const workerId = workerIdRaw.trim();

    const assignmentRows = await this.db
      .select({
        assignment_id: rbacWorkerRoleAssignments.id,
        role_id: rbacWorkerRoleAssignments.roleId,
        created_at: rbacWorkerRoleAssignments.createdAt,
        applied_profile_id: rbacWorkerRoleAssignments.appliedProfileId,
        app_slug: rbacApps.slug,
        app_label: rbacApps.label,
        is_management: rbacApps.isManagement,
        role_slug: rbacRoles.slug,
        role_label: rbacRoles.label,
      })
      .from(rbacWorkerRoleAssignments)
      .innerJoin(rbacRoles, eq(rbacWorkerRoleAssignments.roleId, rbacRoles.id))
      .innerJoin(rbacApps, eq(rbacRoles.appId, rbacApps.id))
      .where(
        and(
          eq(rbacWorkerRoleAssignments.workerId, workerId),
          eq(rbacApps.moduleSlug, moduleSlug),
        ),
      )
      .orderBy(asc(rbacApps.slug));

    if (assignmentRows.length === 0) {
      throw new NotFoundException({
        message: 'Este trabajador no tiene asignaciones en este módulo',
      });
    }

    const nameMap = await this.resolveSapWorkerDisplayNames([workerId]);
    const [wRow] = await this.db
      .select({ name: workers.name })
      .from(workers)
      .where(eq(workers.id, workerId))
      .limit(1);
    const display_name =
      nameMap.get(workerId) ?? wRow?.name?.trim() ?? workerId;

    let assigned_at: string | null = null;
    for (const r of assignmentRows) {
      if (!r.created_at) continue;
      const iso = r.created_at.toISOString();
      if (!assigned_at || iso < assigned_at) assigned_at = iso;
    }

    const appliedProfileIds = [
      ...new Set(
        assignmentRows.map((r) => r.applied_profile_id).filter(Boolean),
      ),
    ] as string[];
    let applied_profile: { slug: string; label: string } | null = null;
    let profileAppActionsBySlug: Map<string, string[]> | null = null;
    if (appliedProfileIds.length > 0) {
      const [profRow] = await this.db
        .select({
          slug: rbacModuleProfiles.slug,
          label: rbacModuleProfiles.label,
          app_permissions_json: rbacModuleProfiles.appPermissionsJson,
        })
        .from(rbacModuleProfiles)
        .where(eq(rbacModuleProfiles.id, appliedProfileIds[0]!))
        .limit(1);
      if (profRow) {
        applied_profile = { slug: profRow.slug, label: profRow.label };
        const norm = normalizeStoredAppPermissionsJson(profRow.app_permissions_json);
        if (norm?.length) {
          profileAppActionsBySlug = new Map(
            norm.map((e) => [e.app_slug, e.actions]),
          );
        }
      }
    }

    const roleIds = [...new Set(assignmentRows.map((r) => r.role_id))];
    const permsByRoleId = new Map<
      string,
      { feature_slug: string; actions: string[] }[]
    >();
    for (const rid of roleIds) {
      const perms = await this.db
        .select({
          feature_slug: rbacAppFeatures.slug,
          actions: rbacRolePermissions.actions,
        })
        .from(rbacRolePermissions)
        .innerJoin(
          rbacAppFeatures,
          eq(rbacRolePermissions.featureId, rbacAppFeatures.id),
        )
        .where(eq(rbacRolePermissions.roleId, rid));
      permsByRoleId.set(
        rid,
        perms.map((p) => ({
          feature_slug: p.feature_slug,
          actions: [...(p.actions ?? [])],
        })),
      );
    }

    const apps_with_access = assignmentRows.map((row) => {
      const profileActs = profileAppActionsBySlug?.get(row.app_slug);
      return {
        assignment_id: row.assignment_id,
        app_slug: row.app_slug,
        app_label: row.app_label,
        role_slug: row.role_slug,
        role_label: row.role_label,
        features: permsByRoleId.get(row.role_id) ?? [],
        ...(profileActs?.length
          ? { profile_product_actions: [...profileActs] }
          : {}),
      };
    });

    const moduleApps = await this.db
      .select({
        slug: rbacApps.slug,
        label: rbacApps.label,
        is_management: rbacApps.isManagement,
      })
      .from(rbacApps)
      .where(eq(rbacApps.moduleSlug, moduleSlug))
      .orderBy(asc(rbacApps.slug));

    const assignedSlugs = new Set(assignmentRows.map((r) => r.app_slug));
    const apps_without_access = moduleApps
      .filter((a) => !assignedSlugs.has(a.slug))
      .map((a) => ({
        app_slug: a.slug,
        app_label: a.label,
        reason: a.is_management
          ? ('solo_admin' as const)
          : ('sin_acceso' as const),
      }));

    return {
      worker_id: workerId,
      display_name,
      assigned_at,
      applied_profile,
      apps_with_access,
      apps_without_access,
    };
  }

  /**
   * Workers con al menos una asignación en el módulo (apps con ese `module_slug`).
   * Búsqueda opcional por SAP (`worker_id`) o nombre en `workers.name`; paginación en memoria sobre el resultado filtrado.
   */
  async listWorkersInModule(
    moduleSlug: string,
    opts?: { search?: string; page?: number; limit?: number },
  ) {
    const searchRaw = opts?.search?.trim() ?? '';
    const pageRaw = opts?.page;
    const limitRaw = opts?.limit;
    const page =
      pageRaw != null && Number.isFinite(Number(pageRaw))
        ? Math.max(1, Math.floor(Number(pageRaw)))
        : 1;
    const limit =
      limitRaw != null && Number.isFinite(Number(limitRaw))
        ? Math.min(50, Math.max(1, Math.floor(Number(limitRaw))))
        : 10;

    const rows = await this.db
      .select({
        workerId: rbacWorkerRoleAssignments.workerId,
        assignmentId: rbacWorkerRoleAssignments.id,
        app_slug: rbacApps.slug,
        role_slug: rbacRoles.slug,
        applied_profile_id: rbacWorkerRoleAssignments.appliedProfileId,
      })
      .from(rbacWorkerRoleAssignments)
      .innerJoin(rbacRoles, eq(rbacWorkerRoleAssignments.roleId, rbacRoles.id))
      .innerJoin(rbacApps, eq(rbacRoles.appId, rbacApps.id))
      .where(eq(rbacApps.moduleSlug, moduleSlug));

    const byWorker = new Map<
      string,
      {
        app_slug: string;
        role_slug: string;
        assignment_id: string;
        applied_profile_id: string | null;
      }[]
    >();
    for (const r of rows) {
      const list = byWorker.get(r.workerId) ?? [];
      list.push({
        app_slug: r.app_slug,
        role_slug: r.role_slug,
        assignment_id: r.assignmentId,
        applied_profile_id: r.applied_profile_id,
      });
      byWorker.set(r.workerId, list);
    }

    const workerIds = [...byWorker.keys()];

    const allAppliedIds = new Set<string>();
    for (const [, assigns] of byWorker) {
      for (const a of assigns) {
        if (a.applied_profile_id) allAppliedIds.add(a.applied_profile_id);
      }
    }
    const profileById = new Map<
      string,
      { slug: string; label: string }
    >();
    if (allAppliedIds.size > 0) {
      const profRows = await this.db
        .select({
          id: rbacModuleProfiles.id,
          slug: rbacModuleProfiles.slug,
          label: rbacModuleProfiles.label,
        })
        .from(rbacModuleProfiles)
        .where(inArray(rbacModuleProfiles.id, [...allAppliedIds]));
      for (const p of profRows) {
        profileById.set(p.id, { slug: p.slug, label: p.label });
      }
    }

    if (workerIds.length === 0) {
      return {
        members: [],
        total: 0,
        page: 1,
        limit,
        profile_counts: {} as Record<string, number>,
      };
    }

    const nameRows = await this.db
      .select({ id: workers.id, name: workers.name })
      .from(workers)
      .where(inArray(workers.id, workerIds));

    const nameById = new Map(nameRows.map((r) => [r.id, r.name]));
    const sapDisplayById = await this.resolveSapWorkerDisplayNames(workerIds);

    type Enriched = {
      worker_id: string;
      display_name: string;
      app_count: number;
      assignments: {
        app_slug: string;
        role_slug: string;
        assignment_id: string;
      }[];
      applied_profile_slug: string | null;
      applied_profile_label: string | null;
      primary: string | null;
    };

    const fullList: Enriched[] = [...byWorker.entries()].map(
      ([worker_id, assignments]) => {
        const rawName = (nameById.get(worker_id) ?? '').trim();
        const fromSap = sapDisplayById.get(worker_id)?.trim() ?? '';
        const displayName = fromSap || rawName;
        const roleSlugs = new Set(assignments.map((a) => a.role_slug));
        const profIds = [
          ...new Set(
            assignments.map((a) => a.applied_profile_id).filter(Boolean),
          ),
        ] as string[];
        let applied_profile_slug: string | null = null;
        let applied_profile_label: string | null = null;
        if (profIds.length === 1) {
          const p = profileById.get(profIds[0]!);
          if (p) {
            applied_profile_slug = p.slug;
            applied_profile_label = p.label;
          }
        } else if (profIds.length > 1) {
          const p = profileById.get(profIds[0]!);
          if (p) {
            applied_profile_slug = p.slug;
            applied_profile_label = p.label;
          }
        }
        const slugSet = new Set(assignments.map((a) => a.app_slug));
        let app_count = slugSet.size;
        if (
          slugSet.has('registro-horas-extra') &&
          slugSet.has('aprobacion-horas-extra')
        ) {
          app_count -= 1;
        }
        return {
          worker_id,
          display_name: displayName,
          app_count,
          assignments: assignments.map((a) => ({
            app_slug: a.app_slug,
            role_slug: a.role_slug,
            assignment_id: a.assignment_id,
          })),
          applied_profile_slug,
          applied_profile_label,
          primary: inferPrimaryProfileSlugForMemberRow(moduleSlug, roleSlugs),
        };
      },
    );

    const q = searchRaw.toLowerCase();
    const filtered = q
      ? fullList.filter((m) => {
          const idMatch = m.worker_id.toLowerCase().includes(q);
          const nameMatch = m.display_name.toLowerCase().includes(q);
          return idMatch || nameMatch;
        })
      : fullList;

    filtered.sort((a, b) => {
      const labelA = (a.display_name || a.worker_id).toLowerCase();
      const labelB = (b.display_name || b.worker_id).toLowerCase();
      const cmp = labelA.localeCompare(labelB, 'es');
      if (cmp !== 0) return cmp;
      return a.worker_id.localeCompare(b.worker_id);
    });

    const profile_counts: Record<string, number> = {};
    for (const m of filtered) {
      const slugKey = m.applied_profile_slug ?? m.primary ?? null;
      if (slugKey) {
        profile_counts[slugKey] = (profile_counts[slugKey] ?? 0) + 1;
      }
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const pageSlice = filtered.slice(start, start + limit);

    const members = pageSlice.map((m) => ({
      worker_id: m.worker_id,
      display_name: m.display_name.length > 0 ? m.display_name : null,
      app_count: m.app_count,
      assignments: m.assignments,
      applied_profile_slug: m.applied_profile_slug,
      applied_profile_label: m.applied_profile_label,
      /** Pista de chip cuando no hay un solo `applied_profile_id` (p. ej. `admin-sistemas` por `module-admin`). */
      primary: m.primary,
    }));

    return {
      members,
      total,
      page: safePage,
      limit,
      profile_counts,
    };
  }

  /** Celdas rol × feature × acciones para documentación UI / matriz. */
  async getPermissionMatrixForModule(moduleSlug: string) {
    const matrix = await this.db
      .select({
        app_slug: rbacApps.slug,
        app_label: rbacApps.label,
        role_slug: rbacRoles.slug,
        role_label: rbacRoles.label,
        feature_slug: rbacAppFeatures.slug,
        feature_label: rbacAppFeatures.label,
        actions: rbacRolePermissions.actions,
      })
      .from(rbacRolePermissions)
      .innerJoin(rbacRoles, eq(rbacRolePermissions.roleId, rbacRoles.id))
      .innerJoin(rbacApps, eq(rbacRoles.appId, rbacApps.id))
      .innerJoin(
        rbacAppFeatures,
        eq(rbacRolePermissions.featureId, rbacAppFeatures.id),
      )
      .where(eq(rbacApps.moduleSlug, moduleSlug))
      .orderBy(asc(rbacApps.slug), asc(rbacRoles.slug), asc(rbacAppFeatures.slug));

    return { matrix };
  }

  async listModuleProfiles(moduleSlug: string) {
    const profiles = await this.db
      .select({
        id: rbacModuleProfiles.id,
        slug: rbacModuleProfiles.slug,
        label: rbacModuleProfiles.label,
        description: rbacModuleProfiles.description,
      })
      .from(rbacModuleProfiles)
      .where(eq(rbacModuleProfiles.moduleSlug, moduleSlug))
      .orderBy(rbacModuleProfiles.label);

    const out = [];
    for (const p of profiles) {
      const [roleRow] = await this.db
        .select({ n: count() })
        .from(rbacDefaultRoleAssignments)
        .where(eq(rbacDefaultRoleAssignments.moduleProfileId, p.id));
      const roleCount = Number(roleRow?.n ?? 0);

      const memberRows = await this.db
        .selectDistinct({ workerId: rbacWorkerRoleAssignments.workerId })
        .from(rbacWorkerRoleAssignments)
        .where(eq(rbacWorkerRoleAssignments.appliedProfileId, p.id));
      const member_count = memberRows.length;

      const roleIds = await this.db
        .select({ roleId: rbacDefaultRoleAssignments.roleId })
        .from(rbacDefaultRoleAssignments)
        .where(eq(rbacDefaultRoleAssignments.moduleProfileId, p.id));
      const rids = roleIds.map((r) => r.roleId);
      let unique_apps_count = 0;
      let permission_matrix_cells = 0;
      if (rids.length > 0) {
        const appSlugs = await this.db
          .selectDistinct({ slug: rbacApps.slug })
          .from(rbacRoles)
          .innerJoin(rbacApps, eq(rbacRoles.appId, rbacApps.id))
          .where(inArray(rbacRoles.id, rids));
        unique_apps_count = appSlugs.length;

        const [permRow] = await this.db
          .select({ n: count() })
          .from(rbacRolePermissions)
          .where(inArray(rbacRolePermissions.roleId, rids));
        permission_matrix_cells = Number(permRow?.n ?? 0);
      }

      out.push({
        id: p.id,
        slug: p.slug,
        label: p.label,
        description: p.description,
        role_count: roleCount,
        member_count,
        is_seed: isModuleSeedProfile(moduleSlug, p.slug),
        unique_apps_count,
        permission_matrix_cells,
      });
    }
    return { profiles: out };
  }

  /**
   * Asigna todos los roles del perfil (`default_role_assignments`) al worker.
   * Cada asignación creada lleva `applied_profile_id` para conteos y borrado seguro.
   * Si el worker ya tiene el rol (cualquier origen), se omite como duplicado.
   */
  async applyModuleProfile(
    workerSap: string,
    profileSlug: string,
    moduleSlug: string,
  ) {
    const [profile] = await this.db
      .select({ id: rbacModuleProfiles.id })
      .from(rbacModuleProfiles)
      .where(
        and(
          eq(rbacModuleProfiles.moduleSlug, moduleSlug),
          eq(rbacModuleProfiles.slug, profileSlug),
        ),
      )
      .limit(1);

    if (!profile) {
      throw new NotFoundException({ message: 'Perfil no encontrado' });
    }

    const links = await this.db
      .select({ roleId: rbacDefaultRoleAssignments.roleId })
      .from(rbacDefaultRoleAssignments)
      .where(eq(rbacDefaultRoleAssignments.moduleProfileId, profile.id));

    const workerId = await this.resolveWorkerIdForRbacAssignment(workerSap);

    let applied = 0;
    let skipped_duplicates = 0;

    for (const { roleId } of links) {
      const [roleRow] = await this.db
        .select({ appModule: rbacApps.moduleSlug })
        .from(rbacRoles)
        .innerJoin(rbacApps, eq(rbacRoles.appId, rbacApps.id))
        .where(eq(rbacRoles.id, roleId))
        .limit(1);
      if (!roleRow || roleRow.appModule !== moduleSlug) {
        continue;
      }

      const [dup] = await this.db
        .select({ id: rbacWorkerRoleAssignments.id })
        .from(rbacWorkerRoleAssignments)
        .where(
          and(
            eq(rbacWorkerRoleAssignments.workerId, workerId),
            eq(rbacWorkerRoleAssignments.roleId, roleId),
          ),
        )
        .limit(1);
      if (dup) {
        skipped_duplicates += 1;
        continue;
      }

      await this.db.insert(rbacWorkerRoleAssignments).values({
        workerId,
        roleId,
        appliedProfileId: profile.id,
      });

      await this.permissionCache.invalidate(workerId);
      applied += 1;
    }

    return { applied, skipped_duplicates };
  }

  /**
   * Réplica SAP (`eiis_trabajadores`), misma idea que `ConsultationsRepository.searchSapWorkers`.
   * Permite encontrar por código o nombre aunque aún no exista fila en `workers`.
   */
  private async searchSapWorkersForSoLookup(qRaw: string): Promise<
    { sap_code: string; name: string }[]
  > {
    if (!this.sapDb) return [];
    const q = qRaw.trim();
    if (q.length < 2) return [];
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

    return sorted.slice(0, 20).map((w) => {
      const name =
        formatStagingWorkerName(w.vorna, w.nachn, w.name2).trim() || w.pernr.trim();
      return { sap_code: w.pernr.trim(), name };
    });
  }

  /** Búsqueda por nombre o código: SAP staging + filas locales en `workers` (UI alta de miembros). */
  async lookupWorkersForSoSettings(qRaw: string) {
    const q = qRaw.trim();
    if (q.length < 2) {
      return { suggestions: [] as { sap_code: string; name: string }[] };
    }
    const pattern = `%${q}%`;
    const localRows = await this.db
      .select({ id: workers.id, name: workers.name })
      .from(workers)
      .where(or(ilike(workers.name, pattern), ilike(workers.id, pattern)))
      .orderBy(asc(workers.name))
      .limit(15);

    const byCode = new Map<string, { sap_code: string; name: string }>();
    const sapSuggestions = await this.searchSapWorkersForSoLookup(q);
    for (const s of sapSuggestions) {
      byCode.set(s.sap_code, s);
    }
    for (const r of localRows) {
      const code = r.id.trim();
      if (!byCode.has(code)) {
        byCode.set(code, {
          sap_code: code,
          name: r.name.trim() || code,
        });
      }
    }

    const suggestions = [...byCode.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'es'),
    );
    return { suggestions: suggestions.slice(0, 20) };
  }

  /**
   * Detalle de un perfil del módulo SO (roles + métricas).
   * `module_profile_items` no se usa en SO; `default_role_assignments` es la fuente de verdad para apply.
   */
  async getModuleProfileDetailForModule(profileId: string, moduleSlug: string) {
    const [p] = await this.db
      .select({
        id: rbacModuleProfiles.id,
        slug: rbacModuleProfiles.slug,
        label: rbacModuleProfiles.label,
        description: rbacModuleProfiles.description,
        app_permissions_json: rbacModuleProfiles.appPermissionsJson,
      })
      .from(rbacModuleProfiles)
      .where(
        and(
          eq(rbacModuleProfiles.id, profileId),
          eq(rbacModuleProfiles.moduleSlug, moduleSlug),
        ),
      )
      .limit(1);

    if (!p) {
      throw new NotFoundException({ message: 'Perfil no encontrado' });
    }

    const is_seed = isModuleSeedProfile(moduleSlug, p.slug);

    const memberRows = await this.db
      .selectDistinct({ workerId: rbacWorkerRoleAssignments.workerId })
      .from(rbacWorkerRoleAssignments)
      .where(eq(rbacWorkerRoleAssignments.appliedProfileId, p.id));
    const member_count = memberRows.length;

    const roleIds = await this.db
      .select({ roleId: rbacDefaultRoleAssignments.roleId })
      .from(rbacDefaultRoleAssignments)
      .where(eq(rbacDefaultRoleAssignments.moduleProfileId, p.id));
    const rids = roleIds.map((r) => r.roleId);

    const roles: {
      role_id: string;
      app_slug: string;
      app_label: string;
      app_is_management: boolean;
      role_slug: string;
      role_label: string;
    }[] = [];
    if (rids.length > 0) {
      const rows = await this.db
        .select({
          role_id: rbacRoles.id,
          app_slug: rbacApps.slug,
          app_label: rbacApps.label,
          app_is_management: rbacApps.isManagement,
          role_slug: rbacRoles.slug,
          role_label: rbacRoles.label,
        })
        .from(rbacRoles)
        .innerJoin(rbacApps, eq(rbacRoles.appId, rbacApps.id))
        .where(inArray(rbacRoles.id, rids))
        .orderBy(asc(rbacApps.slug), asc(rbacRoles.slug));
      for (const r of rows) {
        roles.push({
          role_id: r.role_id,
          app_slug: r.app_slug,
          app_label: r.app_label,
          app_is_management: r.app_is_management,
          role_slug: r.role_slug,
          role_label: r.role_label,
        });
      }
    }

    const appSlugs = new Set(roles.map((r) => r.app_slug));
    let permission_matrix_cells = 0;
    if (rids.length > 0) {
      const [permRow] = await this.db
        .select({ n: count() })
        .from(rbacRolePermissions)
        .where(inArray(rbacRolePermissions.roleId, rids));
      permission_matrix_cells = Number(permRow?.n ?? 0);
    }

    const stored = normalizeStoredAppPermissionsJson(p.app_permissions_json);
    let app_permissions: { app_slug: string; actions: string[] }[];
    if (!is_seed && stored) {
      app_permissions = stored;
    } else {
      const derived: { app_slug: string; actions: string[] }[] = [];
      const seenSlug = new Set<string>();
      for (const r of roles) {
        if (r.app_is_management) continue;
        if (seenSlug.has(r.app_slug)) continue;
        seenSlug.add(r.app_slug);
        const actions = await this.getUnionActionsForRoleId(r.role_id);
        derived.push({
          app_slug: r.app_slug,
          actions: sortSoProfileActions(actions),
        });
      }
      derived.sort((a, b) => a.app_slug.localeCompare(b.app_slug, 'es'));
      app_permissions = derived;
    }

    return {
      id: p.id,
      slug: p.slug,
      label: p.label,
      description: p.description,
      is_seed,
      member_count,
      role_count: roles.length,
      unique_apps_count: appSlugs.size,
      permission_matrix_cells,
      roles,
      app_permissions,
    };
  }

  async createModuleProfileForModule(
    moduleSlug: string,
    body: {
      label: string;
      description?: string | null;
      slug?: string | null;
      app_permissions: { app_slug: string; actions: string[] }[];
    },
  ) {
    const label = body.label.trim();
    if (!label) {
      throw new BadRequestException({ message: 'El nombre es obligatorio' });
    }
    const roleIdsIn = await this.resolveSoModuleProfileRoleIdsFromAppPermissions(
      moduleSlug,
      body.app_permissions,
    );
    if (roleIdsIn.length === 0) {
      throw new BadRequestException({
        message: 'Marcá al menos una acción en alguna aplicación.',
      });
    }

    await this.assertSoRoleIdsNonManagementModule(roleIdsIn, moduleSlug);

    const baseSlug = slugifySoProfileLabel(
      (body.slug ?? '').trim() || label,
    );
    const slug = await this.ensureUniqueProfileSlugInModule(moduleSlug, baseSlug);

    const [inserted] = await this.db
      .insert(rbacModuleProfiles)
      .values({
        moduleSlug,
        slug,
        label,
        description: body.description?.trim() || null,
        appPermissionsJson: body.app_permissions,
      })
      .returning({ id: rbacModuleProfiles.id });

    if (!inserted?.id) {
      throw new ConflictException({ message: 'No se pudo crear el perfil' });
    }

    for (const roleId of roleIdsIn) {
      await this.db.insert(rbacDefaultRoleAssignments).values({
        moduleProfileId: inserted.id,
        roleId,
      });
    }

    return {
      id: inserted.id,
      slug,
      label,
      description: body.description?.trim() || null,
      role_count: roleIdsIn.length,
    };
  }

  /**
   * Actualiza metadatos y/o roles del perfil.
   * **C3:** cambiar `role_ids` no afecta asignaciones ya existentes; solo aplica a `apply-profile` / `replace` futuros.
   */
  async updateModuleProfileForModule(
    profileId: string,
    moduleSlug: string,
    body: {
      label?: string;
      description?: string | null;
      app_permissions?: { app_slug: string; actions: string[] }[];
    },
  ) {
    const [p] = await this.db
      .select({
        id: rbacModuleProfiles.id,
        slug: rbacModuleProfiles.slug,
      })
      .from(rbacModuleProfiles)
      .where(
        and(
          eq(rbacModuleProfiles.id, profileId),
          eq(rbacModuleProfiles.moduleSlug, moduleSlug),
        ),
      )
      .limit(1);

    if (!p) {
      throw new NotFoundException({ message: 'Perfil no encontrado' });
    }

    const is_seed = isModuleSeedProfile(moduleSlug, p.slug);

    if (body.app_permissions !== undefined && is_seed) {
      throw new BadRequestException({
        message:
          'Los perfiles semilla no pueden cambiar sus permisos por API; solo nombre y descripción.',
      });
    }

    const note =
      body.app_permissions !== undefined && !is_seed
        ? 'Los permisos del perfil cambian solo para nuevas asignaciones (apply-profile / reemplazar); los miembros actuales no se modifican.'
        : undefined;

    if (body.label !== undefined || body.description !== undefined) {
      const patch: Partial<typeof rbacModuleProfiles.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (body.label !== undefined) {
        const l = body.label.trim();
        if (!l) {
          throw new BadRequestException({ message: 'El nombre no puede estar vacío' });
        }
        patch.label = l;
      }
      if (body.description !== undefined) {
        patch.description = body.description?.trim() || null;
      }
      await this.db
        .update(rbacModuleProfiles)
        .set(patch)
        .where(eq(rbacModuleProfiles.id, p.id));
    }

    if (body.app_permissions !== undefined && !is_seed) {
      const roleIdsIn = await this.resolveSoModuleProfileRoleIdsFromAppPermissions(
        moduleSlug,
        body.app_permissions,
      );
      if (roleIdsIn.length === 0) {
        throw new BadRequestException({
          message: 'Marcá al menos una acción en alguna aplicación.',
        });
      }
      await this.assertSoRoleIdsNonManagementModule(roleIdsIn, moduleSlug);

      await this.db
        .update(rbacModuleProfiles)
        .set({
          appPermissionsJson: body.app_permissions,
          updatedAt: new Date(),
        })
        .where(eq(rbacModuleProfiles.id, p.id));

      await this.db
        .delete(rbacDefaultRoleAssignments)
        .where(eq(rbacDefaultRoleAssignments.moduleProfileId, p.id));

      for (const roleId of roleIdsIn) {
        await this.db.insert(rbacDefaultRoleAssignments).values({
          moduleProfileId: p.id,
          roleId,
        });
      }
    }

    return {
      ok: true as const,
      id: p.id,
      note,
    };
  }

  async deleteModuleProfileForModule(profileId: string, moduleSlug: string) {
    const [p] = await this.db
      .select({
        id: rbacModuleProfiles.id,
        slug: rbacModuleProfiles.slug,
      })
      .from(rbacModuleProfiles)
      .where(
        and(
          eq(rbacModuleProfiles.id, profileId),
          eq(rbacModuleProfiles.moduleSlug, moduleSlug),
        ),
      )
      .limit(1);

    if (!p) {
      throw new NotFoundException({ message: 'Perfil no encontrado' });
    }

    if (isModuleSeedProfile(moduleSlug, p.slug)) {
      throw new ForbiddenException({
        message: 'No se pueden eliminar los perfiles semilla del módulo.',
      });
    }

    const memberRows = await this.db
      .selectDistinct({ workerId: rbacWorkerRoleAssignments.workerId })
      .from(rbacWorkerRoleAssignments)
      .where(eq(rbacWorkerRoleAssignments.appliedProfileId, p.id));
    if (memberRows.length > 0) {
      throw new ConflictException({
        message:
          'Hay miembros con asignaciones asociadas a este perfil (applied_profile_id). No se puede eliminar.',
      });
    }

    await this.db
      .delete(rbacModuleProfiles)
      .where(eq(rbacModuleProfiles.id, p.id));

    return { deleted: true as const, id: p.id };
  }

  private async getUnionActionsForRoleId(roleId: string): Promise<string[]> {
    const rows = await this.db
      .select({ actions: rbacRolePermissions.actions })
      .from(rbacRolePermissions)
      .where(eq(rbacRolePermissions.roleId, roleId));
    const u = new Set<string>();
    for (const row of rows) {
      for (const a of row.actions ?? ['read']) {
        u.add(a);
      }
    }
    return [...u];
  }

  /**
   * Por cada app con acciones solicitadas, elige un rol cuyos permisos cubren todas las
   * funciones de la app y minimiza acciones “de más” respecto del pedido.
   */
  private async resolveSoModuleProfileRoleIdsFromAppPermissions(
    moduleSlug: string,
    entries: { app_slug: string; actions: string[] }[],
  ): Promise<string[]> {
    const bySlug = new Map<string, Set<string>>();
    for (const e of entries) {
      const slug = e.app_slug.trim();
      if (!slug) continue;
      const set = new Set<string>();
      for (const a of e.actions) {
        const t = a.trim();
        if (t) set.add(t);
      }
      if (set.size === 0) continue;
      if (bySlug.has(slug)) {
        throw new BadRequestException({
          message: `La aplicación "${slug}" está repetida en app_permissions.`,
        });
      }
      bySlug.set(slug, set);
    }

    if (bySlug.size === 0) {
      return [];
    }

    const roleIds: string[] = [];

    for (const [app_slug, requestSet] of bySlug) {
      const [app] = await this.db
        .select({
          id: rbacApps.id,
          label: rbacApps.label,
          isManagement: rbacApps.isManagement,
        })
        .from(rbacApps)
        .where(
          and(eq(rbacApps.slug, app_slug), eq(rbacApps.moduleSlug, moduleSlug)),
        )
        .limit(1);

      if (!app) {
        throw new BadRequestException({
          message: `La aplicación "${app_slug}" no pertenece a este módulo.`,
        });
      }
      if (app.isManagement) {
        throw new BadRequestException({
          message:
            'No se pueden definir permisos de la app de gestión del módulo en un perfil desde esta pantalla.',
        });
      }

      const featureRows = await this.db
        .select({ id: rbacAppFeatures.id })
        .from(rbacAppFeatures)
        .where(eq(rbacAppFeatures.appId, app.id));
      const featureIds = featureRows.map((f) => f.id);
      if (featureIds.length === 0) {
        throw new BadRequestException({
          message: `La aplicación "${app.label}" no tiene funciones RBAC configuradas.`,
        });
      }

      const appRoleRows = await this.db
        .select({ id: rbacRoles.id, level: rbacRoles.level })
        .from(rbacRoles)
        .where(eq(rbacRoles.appId, app.id));
      const appRoleIds = appRoleRows.map((r) => r.id);
      if (appRoleIds.length === 0) {
        throw new BadRequestException({
          message: `La aplicación "${app.label}" no tiene roles.`,
        });
      }

      const levelByRoleId = new Map(appRoleRows.map((r) => [r.id, r.level]));

      const permRows = await this.db
        .select({
          roleId: rbacRolePermissions.roleId,
          featureId: rbacRolePermissions.featureId,
          actions: rbacRolePermissions.actions,
        })
        .from(rbacRolePermissions)
        .where(inArray(rbacRolePermissions.roleId, appRoleIds));

      const byRole = new Map<string, Map<string, Set<string>>>();
      for (const rid of appRoleIds) {
        byRole.set(rid, new Map());
      }
      for (const row of permRows) {
        const fm = byRole.get(row.roleId);
        if (!fm) continue;
        const acts = new Set<string>(row.actions ?? ['read']);
        fm.set(row.featureId, acts);
      }
      for (const rid of appRoleIds) {
        const fm = byRole.get(rid)!;
        for (const fid of featureIds) {
          if (!fm.has(fid)) {
            fm.set(fid, new Set());
          }
        }
      }

      const unionAvailable = new Set<string>();
      for (const rid of appRoleIds) {
        const fm = byRole.get(rid)!;
        for (const fid of featureIds) {
          for (const a of fm.get(fid) ?? []) unionAvailable.add(a);
        }
      }
      for (const a of requestSet) {
        if (!unionAvailable.has(a)) {
          throw new BadRequestException({
            message: `La acción "${a}" no está disponible en "${app.label}".`,
          });
        }
      }

      const candidates: { id: string; excess: number; level: number }[] = [];
      for (const rid of appRoleIds) {
        const fm = byRole.get(rid)!;
        let covers = true;
        for (const fid of featureIds) {
          const granted = fm.get(fid) ?? new Set();
          for (const a of requestSet) {
            if (!granted.has(a)) {
              covers = false;
              break;
            }
          }
          if (!covers) break;
        }
        if (!covers) continue;

        let excess = 0;
        for (const fid of featureIds) {
          const granted = fm.get(fid) ?? new Set();
          for (const a of granted) {
            if (!requestSet.has(a)) excess += 1;
          }
        }
        candidates.push({
          id: rid,
          excess,
          level: levelByRoleId.get(rid) ?? 0,
        });
      }

      if (candidates.length === 0) {
        throw new BadRequestException({
          message: `No hay un rol en catálogo que cubra las acciones elegidas en "${app.label}". Probá otra combinación.`,
        });
      }

      candidates.sort((x, y) => {
        if (x.excess !== y.excess) return x.excess - y.excess;
        return x.level - y.level;
      });
      roleIds.push(candidates[0]!.id);
    }

    return roleIds;
  }

  private async assertSoRoleIdsNonManagementModule(
    roleIds: string[],
    moduleSlug: string,
  ) {
    if (roleIds.length === 0) return;
    const rows = await this.db
      .select({
        id: rbacRoles.id,
        app_slug: rbacApps.slug,
        module_slug: rbacApps.moduleSlug,
        is_management: rbacApps.isManagement,
      })
      .from(rbacRoles)
      .innerJoin(rbacApps, eq(rbacRoles.appId, rbacApps.id))
      .where(inArray(rbacRoles.id, roleIds));

    if (rows.length !== roleIds.length) {
      throw new BadRequestException({ message: 'Uno o más roles no existen' });
    }

    for (const r of rows) {
      if (r.module_slug !== moduleSlug) {
        throw new BadRequestException({
          message: `El rol ${r.app_slug} no pertenece a este módulo`,
        });
      }
      if (r.is_management) {
        throw new BadRequestException({
          message:
            'No puedes incluir roles de la app de gestión del módulo en un perfil personalizado.',
        });
      }
    }
  }

  private async ensureUniqueProfileSlugInModule(
    moduleSlug: string,
    baseSlug: string,
  ): Promise<string> {
    let candidate = baseSlug;
    let n = 0;
    for (;;) {
      const [ex] = await this.db
        .select({ id: rbacModuleProfiles.id })
        .from(rbacModuleProfiles)
        .where(
          and(
            eq(rbacModuleProfiles.moduleSlug, moduleSlug),
            eq(rbacModuleProfiles.slug, candidate),
          ),
        )
        .limit(1);
      if (!ex) {
        return candidate;
      }
      n += 1;
      candidate = `${baseSlug}-${n}`;
    }
  }

  /**
   * Si el trabajador ya existe en `workers` (p. ej. ya tuvo asignaciones), no exigimos SAP staging.
   * Evita fallos al aplicar/cambiar perfil cuando SAP no está disponible o el alta fue solo local.
   */
  private async resolveWorkerIdForRbacAssignment(sapCodeRaw: string): Promise<string> {
    const sapCode = sapCodeRaw.trim();
    if (!sapCode) {
      throw new NotFoundException({ message: 'Worker no encontrado' });
    }
    const [existing] = await this.db
      .select({ id: workers.id })
      .from(workers)
      .where(eq(workers.id, sapCode))
      .limit(1);
    if (existing) {
      return existing.id;
    }
    return this.ensureWorkerStubFromSap(sapCode);
  }

  /**
   * Garantiza una fila en `workers` por cada código SAP: ya existente en SAMI o alta/actualización desde
   * staging (activo). Usado p. ej. al guardar supervisores/aprobadores por subdivisión en WorkForce.
   */
  async ensureWorkersForSapCodes(sapCodes: string[]): Promise<void> {
    const uniq = [...new Set(sapCodes.map((x) => x.trim()).filter(Boolean))];
    for (const id of uniq) {
      await this.resolveWorkerIdForRbacAssignment(id);
    }
  }

  /**
   * `worker_id` en asignaciones RBAC = `pernr` (código SAP), igual que en sesión y caché de permisos.
   * La tabla `workers` es un espejo mínimo para FK: se crea/actualiza aquí desde SAP staging, no es fuente de verdad.
   */
  private async ensureWorkerStubFromSap(sapCodeRaw: string): Promise<string> {
    const sapCode = sapCodeRaw.trim();
    if (!sapCode) {
      throw new NotFoundException({ message: 'Worker no encontrado' });
    }
    if (!this.sapDb) {
      throw new ServiceUnavailableException({
        message: 'SAP staging no disponible',
      });
    }

    const rows = await this.sapDb
      .select()
      .from(eiisTrabajadores)
      .where(eq(eiisTrabajadores.pernr, sapCode));

    let best: (typeof rows)[0] | undefined;
    for (const row of rows) {
      if (!isTrabajadorActivoStat(row.stat2)) continue;
      if (!best || compareStagingRows(row, best) > 0) {
        best = row;
      }
    }

    if (!best) {
      throw new NotFoundException({
        message: 'Worker no encontrado o inactivo en SAP',
      });
    }

    const display =
      formatStagingWorkerName(best.vorna, best.nachn, best.name2).trim() ||
      `Worker ${sapCode}`;

    await this.db
      .insert(workers)
      .values({
        id: sapCode,
        name: display,
      })
      .onConflictDoUpdate({
        target: workers.id,
        set: {
          name: display,
          updatedAt: new Date(),
        },
      });

    return sapCode;
  }

  async assignWorkerRole(body: AssignWorkerRoleBody) {
    const workerId = await this.resolveWorkerIdForRbacAssignment(body.worker_id);

    const [role] = await this.db
      .select({ id: rbacRoles.id })
      .from(rbacRoles)
      .where(eq(rbacRoles.id, body.role_id))
      .limit(1);
    if (!role) {
      throw new NotFoundException({ message: 'Rol no encontrado' });
    }

    const [dup] = await this.db
      .select({ id: rbacWorkerRoleAssignments.id })
      .from(rbacWorkerRoleAssignments)
      .where(
        and(
          eq(rbacWorkerRoleAssignments.workerId, workerId),
          eq(rbacWorkerRoleAssignments.roleId, body.role_id),
          isNull(rbacWorkerRoleAssignments.appliedProfileId),
        ),
      )
      .limit(1);
    if (dup) {
      throw new ConflictException({
        message: 'El worker ya tiene esta asignación manual',
      });
    }

    const [inserted] = await this.db
      .insert(rbacWorkerRoleAssignments)
      .values({
        workerId: workerId,
        roleId: body.role_id,
      })
      .returning({ id: rbacWorkerRoleAssignments.id });

    await this.permissionCache.invalidate(workerId);

    return {
      id: inserted?.id,
      worker_id: workerId,
      role_id: body.role_id,
    };
  }
}
