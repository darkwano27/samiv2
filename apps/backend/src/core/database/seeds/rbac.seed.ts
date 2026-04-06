import { and, count, eq, isNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema';
import { workers } from '../schema/workers';
import { rbacAppFeatures } from '../schema/rbac/app-features';
import { rbacApps } from '../schema/rbac/apps';
import { rbacDefaultRoleAssignments } from '../schema/rbac/default-role-assignments';
import { rbacModuleProfileItems } from '../schema/rbac/module-profile-items';
import { rbacModuleProfiles } from '../schema/rbac/module-profiles';
import { rbacRolePermissions } from '../schema/rbac/role-permissions';
import { rbacRoles } from '../schema/rbac/roles';
import { rbacWorkerRoleAssignments } from '../schema/rbac/worker-role-assignments';

type Db = PostgresJsDatabase<typeof schema>;

const APP_DEFS = [
  {
    slug: 'sami-platform',
    moduleSlug: 'platform',
    label: 'Plataforma SAMI',
    isManagement: true,
  },
  {
    slug: 'mis-consultas',
    moduleSlug: 'salud-ocupacional',
    label: 'Mis consultas',
    isManagement: false,
  },
  {
    slug: 'mis-equipos',
    moduleSlug: 'sistemas',
    label: 'Mis equipos',
    isManagement: false,
  },
  /**
   * App de **gestión** del módulo navegación `salud-ocupacional` (sidebar / dashboard).
   * Asignar rol `module-admin` aquí otorga `managed_module_slugs: ['salud-ocupacional']` y acceso UI a todas las apps del módulo.
   */
  {
    slug: 'registro-consulta',
    moduleSlug: 'salud-ocupacional',
    label: 'Registro de consulta',
    isManagement: false,
  },
  {
    slug: 'historial-medico',
    moduleSlug: 'salud-ocupacional',
    label: 'Historial médico',
    isManagement: false,
  },
  {
    slug: 'inventario-medico',
    moduleSlug: 'salud-ocupacional',
    label: 'Inventario médico',
    isManagement: false,
  },
  {
    slug: 'reportes-so',
    moduleSlug: 'salud-ocupacional',
    label: 'Reportes SO',
    isManagement: false,
  },
  {
    slug: 'salud-ocupacional-gestion',
    moduleSlug: 'salud-ocupacional',
    label: 'Gestión Salud Ocupacional',
    isManagement: true,
  },
  {
    slug: 'horas-extra-gestion',
    moduleSlug: 'horas-extra',
    label: 'Gestión WorkForce',
    isManagement: true,
  },
  {
    slug: 'registro-horas-extra',
    moduleSlug: 'horas-extra',
    label: 'Registro de horas extra',
    isManagement: false,
  },
  {
    slug: 'aprobacion-horas-extra',
    moduleSlug: 'horas-extra',
    label: 'Aprobación de horas extra',
    isManagement: false,
  },
  {
    slug: 'visitas-gestion',
    moduleSlug: 'visitas',
    label: 'Gestión Visitas',
    isManagement: true,
  },
  {
    slug: 'crm-quimicos-gestion',
    moduleSlug: 'crm-quimicos',
    label: 'Gestión CRM Químicos',
    isManagement: true,
  },
  {
    slug: 'sistemas-gestion',
    moduleSlug: 'sistemas',
    label: 'Gestión Sistemas',
    isManagement: true,
  },
  {
    slug: 'asignacion-bienes',
    moduleSlug: 'sistemas',
    label: 'Asignación de bienes',
    isManagement: false,
  },
  {
    slug: 'registro-productividad',
    moduleSlug: 'sistemas',
    label: 'Registro de productividad',
    isManagement: false,
  },
  {
    slug: 'administracion-gestion',
    moduleSlug: 'administracion',
    label: 'Gestión Administración',
    isManagement: true,
  },
] as const;

const FEATURE_DEFS = [
  { appSlug: 'mis-consultas', slug: 'listar', label: 'Listar consultas' },
  { appSlug: 'mis-equipos', slug: 'listar', label: 'Listar equipos' },
  {
    appSlug: 'asignacion-bienes',
    slug: 'operar',
    label: 'Asignación y reportes de bienes',
  },
  {
    appSlug: 'registro-productividad',
    slug: 'registrar',
    label: 'Registro de productividad',
  },
  {
    appSlug: 'registro-consulta',
    slug: 'operar',
    label: 'Registro, catálogos y consulta',
  },
  {
    appSlug: 'historial-medico',
    slug: 'listar',
    label: 'Listar y exportar historial',
  },
  {
    appSlug: 'inventario-medico',
    slug: 'inventario',
    label: 'Gestión de inventario',
  },
  {
    appSlug: 'reportes-so',
    slug: 'ver',
    label: 'Consulta de reportes',
  },
  {
    appSlug: 'registro-horas-extra',
    slug: 'boletas',
    label: 'Boletas de horas extra',
  },
  {
    appSlug: 'aprobacion-horas-extra',
    slug: 'bandeja',
    label: 'Bandeja y aprobación de boletas',
  },
] as const;

const ROLE_DEFS = [
  {
    appSlug: 'sami-platform',
    slug: 'superadmin',
    label: 'Super administrador',
    level: 100,
  },
  {
    appSlug: 'mis-consultas',
    slug: 'viewer',
    label: 'Solo lectura',
    level: 10,
  },
  {
    appSlug: 'mis-equipos',
    slug: 'viewer',
    label: 'Solo lectura',
    level: 10,
  },
  {
    appSlug: 'mis-equipos',
    slug: 'admin',
    label: 'Administrador — mis equipos',
    level: 45,
  },
  {
    appSlug: 'asignacion-bienes',
    slug: 'soporte',
    label: 'Soporte — asignación bienes',
    level: 20,
  },
  {
    appSlug: 'asignacion-bienes',
    slug: 'admin',
    label: 'Administrador — asignación bienes',
    level: 45,
  },
  {
    appSlug: 'registro-productividad',
    slug: 'operador',
    label: 'Operador productividad',
    level: 20,
  },
  {
    appSlug: 'registro-productividad',
    slug: 'admin',
    label: 'Administrador productividad',
    level: 45,
  },
  {
    appSlug: 'salud-ocupacional-gestion',
    slug: 'module-admin',
    label: 'Administrador del módulo Salud Ocupacional',
    level: 50,
  },
  {
    appSlug: 'horas-extra-gestion',
    slug: 'module-admin',
    label: 'Administrador del módulo WorkForce',
    level: 50,
  },
  {
    appSlug: 'registro-horas-extra',
    slug: 'supervisor',
    label: 'Supervisor — registro HE',
    level: 22,
  },
  {
    appSlug: 'aprobacion-horas-extra',
    slug: 'aprobador',
    label: 'Aprobador — horas extra',
    level: 24,
  },
  {
    appSlug: 'visitas-gestion',
    slug: 'module-admin',
    label: 'Administrador del módulo Visitas',
    level: 50,
  },
  {
    appSlug: 'crm-quimicos-gestion',
    slug: 'module-admin',
    label: 'Administrador del módulo CRM Químicos',
    level: 50,
  },
  {
    appSlug: 'sistemas-gestion',
    slug: 'module-admin',
    label: 'Administrador del módulo Sistemas',
    level: 50,
  },
  {
    appSlug: 'administracion-gestion',
    slug: 'module-admin',
    label: 'Administrador del módulo Administración',
    level: 50,
  },
  {
    appSlug: 'registro-consulta',
    slug: 'enfermera',
    label: 'Enfermera (SO)',
    level: 18,
  },
  {
    appSlug: 'registro-consulta',
    slug: 'jefe-so',
    label: 'Admin SO — registro',
    level: 45,
  },
  {
    appSlug: 'historial-medico',
    slug: 'enfermera',
    label: 'Enfermera (SO)',
    level: 18,
  },
  {
    appSlug: 'historial-medico',
    slug: 'jefe-so',
    label: 'Admin SO — historial',
    level: 45,
  },
  {
    appSlug: 'inventario-medico',
    slug: 'enfermera',
    label: 'Enfermera (SO)',
    level: 18,
  },
  {
    appSlug: 'inventario-medico',
    slug: 'jefe-so',
    label: 'Jefe SO — inventario',
    level: 45,
  },
  {
    appSlug: 'reportes-so',
    slug: 'enfermera',
    label: 'Enfermera (SO)',
    level: 18,
  },
  {
    appSlug: 'reportes-so',
    slug: 'jefe-so',
    label: 'Admin SO — reportes',
    level: 45,
  },
] as const;

/**
 * Tras `seed:rbac`, este worker queda con rol **superadmin** (app `sami-platform`) si aún no lo tenía.
 * Idempotente: no duplica filas en `worker_role_assignments`.
 */
const BOOTSTRAP_SUPERADMIN_WORKER_ID = '64721';

/**
 * Catálogo RBAC mínimo (idempotente). Incluye asignación bootstrap de superadmin al worker
 * {@link BOOTSTRAP_SUPERADMIN_WORKER_ID} (crea `workers` mínimo si no existe).
 */
export async function runRbacSeed(db: Db): Promise<void> {
  for (const a of APP_DEFS) {
    await db.insert(rbacApps).values(a).onConflictDoNothing({ target: rbacApps.slug });
  }

  const apps = await db.select().from(rbacApps);
  const appIdBySlug = new Map(apps.map((r) => [r.slug, r.id]));

  for (const f of FEATURE_DEFS) {
    const appId = appIdBySlug.get(f.appSlug);
    if (!appId) continue;
    await db
      .insert(rbacAppFeatures)
      .values({
        appId,
        slug: f.slug,
        label: f.label,
      })
      .onConflictDoNothing({
        target: [rbacAppFeatures.appId, rbacAppFeatures.slug],
      });
  }

  const features = await db.select().from(rbacAppFeatures);
  const featureIdByKey = new Map<string, string>();
  for (const f of features) {
    const app = apps.find((a) => a.id === f.appId);
    if (app) featureIdByKey.set(`${app.slug}:${f.slug}`, f.id);
  }

  for (const r of ROLE_DEFS) {
    const appId = appIdBySlug.get(r.appSlug);
    if (!appId) continue;
    await db
      .insert(rbacRoles)
      .values({
        appId,
        slug: r.slug,
        label: r.label,
        level: r.level,
      })
      .onConflictDoNothing({
        target: [rbacRoles.appId, rbacRoles.slug],
      });
  }

  const roles = await db.select().from(rbacRoles);
  const roleIdByKey = new Map<string, string>();
  for (const r of roles) {
    const app = apps.find((a) => a.id === r.appId);
    if (app) roleIdByKey.set(`${app.slug}:${r.slug}`, r.id);
  }

  const permDefs: { roleKey: string; featureKey: string; actions: string[] }[] = [
    {
      roleKey: 'mis-consultas:viewer',
      featureKey: 'mis-consultas:listar',
      actions: ['read'],
    },
    {
      roleKey: 'mis-equipos:viewer',
      featureKey: 'mis-equipos:listar',
      actions: ['read'],
    },
    {
      roleKey: 'registro-consulta:enfermera',
      featureKey: 'registro-consulta:operar',
      actions: ['read', 'create'],
    },
    {
      roleKey: 'registro-consulta:jefe-so',
      featureKey: 'registro-consulta:operar',
      actions: ['read', 'create'],
    },
    {
      roleKey: 'historial-medico:enfermera',
      featureKey: 'historial-medico:listar',
      actions: ['read', 'update', 'delete'],
    },
    {
      roleKey: 'historial-medico:jefe-so',
      featureKey: 'historial-medico:listar',
      actions: ['read', 'update', 'delete'],
    },
    {
      roleKey: 'inventario-medico:enfermera',
      featureKey: 'inventario-medico:inventario',
      actions: ['read', 'create', 'update', 'delete'],
    },
    {
      roleKey: 'inventario-medico:jefe-so',
      featureKey: 'inventario-medico:inventario',
      actions: ['read', 'create', 'update', 'delete'],
    },
    {
      roleKey: 'reportes-so:enfermera',
      featureKey: 'reportes-so:ver',
      actions: ['read'],
    },
    {
      roleKey: 'reportes-so:jefe-so',
      featureKey: 'reportes-so:ver',
      actions: ['read'],
    },
    {
      roleKey: 'asignacion-bienes:soporte',
      featureKey: 'asignacion-bienes:operar',
      actions: ['read', 'create'],
    },
    {
      roleKey: 'asignacion-bienes:admin',
      featureKey: 'asignacion-bienes:operar',
      actions: ['read', 'create', 'update', 'delete'],
    },
    {
      roleKey: 'registro-productividad:operador',
      featureKey: 'registro-productividad:registrar',
      actions: ['read', 'create', 'update'],
    },
    {
      roleKey: 'registro-productividad:admin',
      featureKey: 'registro-productividad:registrar',
      actions: ['read', 'create', 'update', 'delete'],
    },
    {
      roleKey: 'mis-equipos:admin',
      featureKey: 'mis-equipos:listar',
      actions: ['read', 'create', 'update', 'delete'],
    },
    {
      roleKey: 'registro-horas-extra:supervisor',
      featureKey: 'registro-horas-extra:boletas',
      actions: ['read', 'create', 'update', 'delete'],
    },
    {
      roleKey: 'aprobacion-horas-extra:aprobador',
      featureKey: 'aprobacion-horas-extra:bandeja',
      actions: ['read', 'create', 'update', 'delete'],
    },
  ];

  for (const { roleKey, featureKey, actions } of permDefs) {
    const roleId = roleIdByKey.get(roleKey);
    const featureId = featureIdByKey.get(featureKey);
    if (!roleId || !featureId) continue;
    await db
      .insert(rbacRolePermissions)
      .values({ roleId, featureId, actions })
      .onConflictDoUpdate({
        target: [rbacRolePermissions.roleId, rbacRolePermissions.featureId],
        set: { actions },
      });
  }

  await seedSaludOcupacionalProfiles(db, roleIdByKey);
  await seedSistemasProfiles(db, roleIdByKey);
  await seedWorkforceProfiles(db, roleIdByKey);

  const consultasViewerId = roleIdByKey.get('mis-consultas:viewer');
  const equiposViewerId = roleIdByKey.get('mis-equipos:viewer');
  const consultasAppId = appIdBySlug.get('mis-consultas');
  const equiposAppId = appIdBySlug.get('mis-equipos');
  const consultasListarId = featureIdByKey.get('mis-consultas:listar');
  const equiposListarId = featureIdByKey.get('mis-equipos:listar');

  const [existingProfile] = await db
    .select()
    .from(rbacModuleProfiles)
    .where(
      and(
        eq(rbacModuleProfiles.moduleSlug, 'global'),
        eq(rbacModuleProfiles.slug, 'default-operator'),
      ),
    )
    .limit(1);

  let profileId = existingProfile?.id;
  if (!profileId) {
    const [inserted] = await db
      .insert(rbacModuleProfiles)
      .values({
        moduleSlug: 'global',
        slug: 'default-operator',
        label: 'Operador estándar',
        description: 'Viewer en consultas y equipos (perfil semilla)',
      })
      .returning({ id: rbacModuleProfiles.id });
    profileId = inserted?.id;
  }

  if (
    profileId &&
    consultasViewerId &&
    equiposViewerId &&
    consultasAppId &&
    equiposAppId &&
    consultasListarId &&
    equiposListarId
  ) {
    for (const roleId of [consultasViewerId, equiposViewerId]) {
      const [dup] = await db
        .select({ id: rbacDefaultRoleAssignments.id })
        .from(rbacDefaultRoleAssignments)
        .where(
          and(
            eq(rbacDefaultRoleAssignments.moduleProfileId, profileId),
            eq(rbacDefaultRoleAssignments.roleId, roleId),
          ),
        )
        .limit(1);
      if (!dup) {
        await db.insert(rbacDefaultRoleAssignments).values({
          moduleProfileId: profileId,
          roleId,
        });
      }
    }

    const profileItems: {
      appId: string;
      featureId: string;
      roleId: string;
    }[] = [
      {
        appId: consultasAppId,
        featureId: consultasListarId,
        roleId: consultasViewerId,
      },
      {
        appId: equiposAppId,
        featureId: equiposListarId,
        roleId: equiposViewerId,
      },
    ];

    for (const row of profileItems) {
      await db
        .insert(rbacModuleProfileItems)
        .values({ profileId, ...row })
        .onConflictDoNothing({
          target: [
            rbacModuleProfileItems.profileId,
            rbacModuleProfileItems.appId,
            rbacModuleProfileItems.featureId,
            rbacModuleProfileItems.roleId,
          ],
        });
    }
  }

  await assignBootstrapSuperadmin(db, roleIdByKey);

  // eslint-disable-next-line no-console -- seed script
  console.log(
    '[seed:rbac] catálogo listo: apps/features/roles, role_permissions.actions, perfiles SO, Sistemas, WorkForce, default-operator.',
  );
}

/** Perfiles SO ↔ roles por app (matriz funcional). Idempotente. */
async function seedSaludOcupacionalProfiles(
  db: Db,
  roleIdByKey: Map<string, string>,
): Promise<void> {
  const MODULE = 'salud-ocupacional';
  const defs = [
    {
      slug: 'enfermera',
      label: 'Enfermera',
      roleKeys: [
        'registro-consulta:enfermera',
        'historial-medico:enfermera',
        'mis-consultas:viewer',
        'inventario-medico:enfermera',
        'reportes-so:enfermera',
      ],
    },
    {
      slug: 'jefe-so',
      label: 'Admin SO (perfil principal)',
      roleKeys: [
        'registro-consulta:jefe-so',
        'historial-medico:jefe-so',
        'mis-consultas:viewer',
        'inventario-medico:jefe-so',
        'reportes-so:jefe-so',
        'salud-ocupacional-gestion:module-admin',
      ],
    },
  ] as const;

  for (const p of defs) {
    const [existing] = await db
      .select({ id: rbacModuleProfiles.id })
      .from(rbacModuleProfiles)
      .where(
        and(
          eq(rbacModuleProfiles.moduleSlug, MODULE),
          eq(rbacModuleProfiles.slug, p.slug),
        ),
      )
      .limit(1);

    let profileId = existing?.id;
    if (!profileId) {
      const [ins] = await db
        .insert(rbacModuleProfiles)
        .values({
          moduleSlug: MODULE,
          slug: p.slug,
          label: p.label,
          description:
            p.slug === 'jefe-so'
              ? 'Control total del módulo Salud ocupacional (apps operativas + administración).'
              : 'Operación clínica en todas las apps del módulo (sin administración de módulo).',
        })
        .returning({ id: rbacModuleProfiles.id });
      profileId = ins?.id;
    }
    if (!profileId) continue;

    const description =
      p.slug === 'jefe-so'
        ? 'Control total del módulo Salud ocupacional (apps operativas + administración).'
        : 'Operación clínica en todas las apps del módulo (sin administración de módulo).';

    await db
      .update(rbacModuleProfiles)
      .set({
        label: p.label,
        description,
        updatedAt: new Date(),
      })
      .where(eq(rbacModuleProfiles.id, profileId));

    await db
      .delete(rbacDefaultRoleAssignments)
      .where(eq(rbacDefaultRoleAssignments.moduleProfileId, profileId));

    for (const rk of p.roleKeys) {
      const roleId = roleIdByKey.get(rk);
      if (!roleId) continue;
      await db.insert(rbacDefaultRoleAssignments).values({
        moduleProfileId: profileId,
        roleId,
      });
    }
  }

  await pruneObsoleteSaludOcupacionalProfiles(db);
}

/** Perfiles semilla Sistemas (Soporte, Aplicaciones, Infraestructura, Admin). Idempotente. */
async function seedSistemasProfiles(
  db: Db,
  roleIdByKey: Map<string, string>,
): Promise<void> {
  const MODULE = 'sistemas';
  const defs = [
    {
      slug: 'soporte',
      label: 'Soporte',
      description:
        'Asignación de bienes (lectura y creación), registro de productividad (lectura, creación y edición), Mis equipos (lectura).',
      roleKeys: [
        'asignacion-bienes:soporte',
        'registro-productividad:operador',
        'mis-equipos:viewer',
      ],
    },
    {
      slug: 'aplicaciones',
      label: 'Aplicaciones',
      description:
        'Registro de productividad (lectura, creación y edición) y Mis equipos (lectura).',
      roleKeys: [
        'registro-productividad:operador',
        'mis-equipos:viewer',
      ],
    },
    {
      slug: 'infraestructura',
      label: 'Infraestructura',
      description:
        'Asignación de bienes (lectura y creación), registro de productividad (lectura, creación y edición), Mis equipos (lectura).',
      roleKeys: [
        'asignacion-bienes:soporte',
        'registro-productividad:operador',
        'mis-equipos:viewer',
      ],
    },
    {
      slug: 'admin-sistemas',
      label: 'Admin Sistemas',
      description:
        'Control total del módulo Sistemas: todas las apps operativas con permisos completos y administración del módulo.',
      roleKeys: [
        'asignacion-bienes:admin',
        'registro-productividad:admin',
        'mis-equipos:admin',
        'sistemas-gestion:module-admin',
      ],
    },
  ] as const;

  for (const p of defs) {
    const [existing] = await db
      .select({ id: rbacModuleProfiles.id })
      .from(rbacModuleProfiles)
      .where(
        and(
          eq(rbacModuleProfiles.moduleSlug, MODULE),
          eq(rbacModuleProfiles.slug, p.slug),
        ),
      )
      .limit(1);

    let profileId = existing?.id;
    if (!profileId) {
      const [ins] = await db
        .insert(rbacModuleProfiles)
        .values({
          moduleSlug: MODULE,
          slug: p.slug,
          label: p.label,
          description: p.description,
        })
        .returning({ id: rbacModuleProfiles.id });
      profileId = ins?.id;
    }
    if (!profileId) continue;

    await db
      .update(rbacModuleProfiles)
      .set({
        label: p.label,
        description: p.description,
        updatedAt: new Date(),
      })
      .where(eq(rbacModuleProfiles.id, profileId));

    await db
      .delete(rbacDefaultRoleAssignments)
      .where(eq(rbacDefaultRoleAssignments.moduleProfileId, profileId));

    for (const rk of p.roleKeys) {
      const roleId = roleIdByKey.get(rk);
      if (!roleId) continue;
      await db.insert(rbacDefaultRoleAssignments).values({
        moduleProfileId: profileId,
        roleId,
      });
    }
  }
}

/** Perfiles semilla WorkForce (Supervisor, Aprobador, Admin-WF). Idempotente. */
async function seedWorkforceProfiles(
  db: Db,
  roleIdByKey: Map<string, string>,
): Promise<void> {
  const MODULE = 'horas-extra';
  const defs = [
    {
      slug: 'supervisor-he',
      label: 'Supervisor',
      description:
        'Registro de horas extra: consultar, crear, editar y anular boletas antes de aprobarlas.',
      roleKeys: ['registro-horas-extra:supervisor'],
    },
    {
      slug: 'aprobador-he',
      label: 'Aprobador',
      description:
        'Mismas operaciones que supervisor en boletas, más la app de aprobación y bandeja.',
      roleKeys: ['registro-horas-extra:supervisor', 'aprobacion-horas-extra:aprobador'],
    },
    {
      slug: 'admin-wf',
      label: 'Admin WorkForce',
      description:
        'Administración del módulo (ajustes, roles) y permisos operativos completos.',
      roleKeys: [
        'horas-extra-gestion:module-admin',
        'registro-horas-extra:supervisor',
        'aprobacion-horas-extra:aprobador',
      ],
    },
  ] as const;

  for (const p of defs) {
    const [existing] = await db
      .select({ id: rbacModuleProfiles.id })
      .from(rbacModuleProfiles)
      .where(
        and(eq(rbacModuleProfiles.moduleSlug, MODULE), eq(rbacModuleProfiles.slug, p.slug)),
      )
      .limit(1);

    let profileId = existing?.id;
    if (!profileId) {
      const [ins] = await db
        .insert(rbacModuleProfiles)
        .values({
          moduleSlug: MODULE,
          slug: p.slug,
          label: p.label,
          description: p.description,
        })
        .returning({ id: rbacModuleProfiles.id });
      profileId = ins?.id;
    }
    if (!profileId) continue;

    await db
      .update(rbacModuleProfiles)
      .set({
        label: p.label,
        description: p.description,
        updatedAt: new Date(),
      })
      .where(eq(rbacModuleProfiles.id, profileId));

    await db
      .delete(rbacDefaultRoleAssignments)
      .where(eq(rbacDefaultRoleAssignments.moduleProfileId, profileId));

    for (const rk of p.roleKeys) {
      const roleId = roleIdByKey.get(rk);
      if (!roleId) continue;
      await db.insert(rbacDefaultRoleAssignments).values({
        moduleProfileId: profileId,
        roleId,
      });
    }
  }
}

/** Quita perfiles semilla viejos (p. ej. médico/farmacéutico) si nadie los tiene como applied_profile_id. */
async function pruneObsoleteSaludOcupacionalProfiles(db: Db): Promise<void> {
  const MODULE = 'salud-ocupacional';
  const obsolete = ['medico', 'farmaceutico'] as const;
  for (const slug of obsolete) {
    const [row] = await db
      .select({ id: rbacModuleProfiles.id })
      .from(rbacModuleProfiles)
      .where(
        and(eq(rbacModuleProfiles.moduleSlug, MODULE), eq(rbacModuleProfiles.slug, slug)),
      )
      .limit(1);
    if (!row) continue;
    const [cntRow] = await db
      .select({ n: count() })
      .from(rbacWorkerRoleAssignments)
      .where(eq(rbacWorkerRoleAssignments.appliedProfileId, row.id));
    if (Number(cntRow?.n ?? 0) > 0) {
      // eslint-disable-next-line no-console -- seed script
      console.warn(
        `[seed:rbac] perfil SO "${slug}" aún tiene miembros (applied_profile_id); no se elimina automáticamente.`,
      );
      continue;
    }
    await db
      .delete(rbacDefaultRoleAssignments)
      .where(eq(rbacDefaultRoleAssignments.moduleProfileId, row.id));
    await db.delete(rbacModuleProfiles).where(eq(rbacModuleProfiles.id, row.id));
  }
}

async function assignBootstrapSuperadmin(
  db: Db,
  roleIdByKey: Map<string, string>,
): Promise<void> {
  const superadminRoleId = roleIdByKey.get('sami-platform:superadmin');
  if (!superadminRoleId) {
    // eslint-disable-next-line no-console -- seed script
    console.warn(
      '[seed:rbac] no se encontró rol sami-platform:superadmin; omito bootstrap superadmin.',
    );
    return;
  }

  await db
    .insert(workers)
    .values({
      id: BOOTSTRAP_SUPERADMIN_WORKER_ID,
      name: `Worker ${BOOTSTRAP_SUPERADMIN_WORKER_ID}`,
    })
    .onConflictDoNothing({ target: workers.id });

  const [existing] = await db
    .select({ id: rbacWorkerRoleAssignments.id })
    .from(rbacWorkerRoleAssignments)
    .where(
      and(
        eq(rbacWorkerRoleAssignments.workerId, BOOTSTRAP_SUPERADMIN_WORKER_ID),
        eq(rbacWorkerRoleAssignments.roleId, superadminRoleId),
        isNull(rbacWorkerRoleAssignments.appliedProfileId),
      ),
    )
    .limit(1);

  if (existing) {
    // eslint-disable-next-line no-console -- seed script
    console.log(
      `[seed:rbac] worker ${BOOTSTRAP_SUPERADMIN_WORKER_ID} ya tiene superadmin; sin cambios.`,
    );
    return;
  }

  await db.insert(rbacWorkerRoleAssignments).values({
    workerId: BOOTSTRAP_SUPERADMIN_WORKER_ID,
    roleId: superadminRoleId,
  });

  // eslint-disable-next-line no-console -- seed script
  console.log(
    `[seed:rbac] asignado rol superadmin a worker ${BOOTSTRAP_SUPERADMIN_WORKER_ID}.`,
  );
}
