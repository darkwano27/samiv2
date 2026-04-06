export type RbacScope = 'global' | 'division' | 'subdivision';

/** Una asignación activa con permisos agregados por feature (acciones). */
export interface CachedAssignment {
  appSlug: string;
  moduleSlug: string;
  roleSlug: string;
  roleLevel: number;
  scope: RbacScope;
  scopeId: string | null;
  permissions: Record<string, string[]>;
}

/** Resultado de `resolvePermissions` / valor en Redis `rbac:perms:{workerId}`. */
export interface CachedPermissions {
  workerId: string;
  isSuperadmin: boolean;
  /** `module_slug` de apps con `is_management = true` donde el worker tiene rol activo. */
  managedModuleSlugs: string[];
  assignments: CachedAssignment[];
}
