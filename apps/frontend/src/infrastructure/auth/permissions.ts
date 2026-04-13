import type { MeResult } from '@/modules/auth/repository/auth.repository';
import { getModuleSlugForNavApp } from '@/shared/components/sidebar/navigation-config';

/**
 * Control de visibilidad en sidebar / `assertAppAccess`. Por defecto **activo**;
 * poné `VITE_RBAC_ENABLED=false` en `.env` solo para rollout temporal.
 */
export const RBAC_ENABLED = import.meta.env.VITE_RBAC_ENABLED !== 'false';

/**
 * Rutas de navegación que consumen `/api/admin/*` (solo **superadmin** en backend).
 * No deben abrirse con rol `module-admin` de `administracion-gestion`.
 */
const SUPERADMIN_ONLY_NAV_APPS = new Set([
  'gestion-usuarios',
  'administracion-ajustes',
]);

/**
 * Slug de app en navegación (`navigation-config`) → slug en catálogo RBAC (`apps.slug`).
 * El sidebar usa nombres distintos a la app de gestión en algunos módulos.
 */
const NAV_APP_TO_RBAC_APP: Record<string, string> = {
  'salud-ocupacional-ajustes': 'salud-ocupacional-gestion',
  'sistemas-ajustes': 'sistemas-gestion',
  'horas-extra-ajustes': 'horas-extra-gestion',
};

/** Slugs de `app_roles` que aplican a una app de la navegación (nav y/o RBAC). */
function rbacAppSlugsForNav(navAppSlug: string): string[] {
  const mapped = NAV_APP_TO_RBAC_APP[navAppSlug];
  return mapped ? [navAppSlug, mapped] : [navAppSlug];
}

function hasExplicitAppRole(session: Session, navAppSlug: string): boolean {
  const candidates = rbacAppSlugsForNav(navAppSlug);
  return session.appRoles.some((r) => candidates.includes(r.appSlug));
}

/** Admin de módulo (`module-admin` en app de gestión): acceso a todas las apps de ese módulo en UI. */
function isManagedModuleForNavApp(session: Session, navAppSlug: string): boolean {
  const moduleSlug = getModuleSlugForNavApp(navAppSlug);
  if (!moduleSlug) return false;
  return (session.managedModuleSlugs ?? []).includes(moduleSlug);
}

/** Sesión de permisos alineada a `GET /auth/me` (mapeo ya hecho en `AuthApiRepository`). */
export type Session = MeResult;

/**
 * Entrada única en sidebar: `/horas-extra/registro-horas-extra`.
 * Quien solo tenga la app técnica `aprobacion-horas-extra` también entra ahí.
 */
export function canAccessBoletasHorasExtraNav(session: Session | null): boolean {
  if (!RBAC_ENABLED) return true;
  if (!session) return false;
  if (session.isSuperadmin) return true;
  return (
    canAccessApp(session, 'registro-horas-extra') ||
    canAccessApp(session, 'aprobacion-horas-extra')
  );
}

export function canAccessApp(session: Session | null, appSlug: string): boolean {
  if (!RBAC_ENABLED) {
    /** Alineado con `SaludOcupacionalModuleAdminGuard`: sin RBAC en UI igual hace falta rol de gestión en backend. */
    if (appSlug === 'salud-ocupacional-ajustes') {
      if (!session) return false;
      if (session.isSuperadmin) return true;
      return session.managedModuleSlugs.includes('salud-ocupacional');
    }
    if (appSlug === 'sistemas-ajustes') {
      if (!session) return false;
      if (session.isSuperadmin) return true;
      return (session.managedModuleSlugs ?? []).includes('sistemas');
    }
    if (appSlug === 'horas-extra-ajustes') {
      if (!session) return false;
      if (session.isSuperadmin) return true;
      return (session.managedModuleSlugs ?? []).includes('horas-extra');
    }
    return true;
  }
  if (!session) return false;
  if (session.isSuperadmin) return true;
  if (SUPERADMIN_ONLY_NAV_APPS.has(appSlug)) return false;
  /** Solo administración del módulo Sistemas o rol explícito en gestión; no se hereda por otras apps del módulo. */
  if (appSlug === 'sistemas-ajustes') {
    return (
      hasExplicitAppRole(session, 'sistemas-ajustes') ||
      (session.managedModuleSlugs ?? []).includes('sistemas')
    );
  }
  if (appSlug === 'horas-extra-ajustes') {
    return (
      hasExplicitAppRole(session, 'horas-extra-ajustes') ||
      (session.managedModuleSlugs ?? []).includes('horas-extra')
    );
  }
  if (hasExplicitAppRole(session, appSlug)) return true;
  return isManagedModuleForNavApp(session, appSlug);
}

export function hasMinRole(
  session: Session | null,
  appSlug: string,
  minLevel: number,
): boolean {
  if (!RBAC_ENABLED) return true;
  if (!session) return false;
  if (session.isSuperadmin) return true;
  if (SUPERADMIN_ONLY_NAV_APPS.has(appSlug)) return false;
  if (isManagedModuleForNavApp(session, appSlug)) return true;
  const slugs = rbacAppSlugsForNav(appSlug);
  return session.appRoles.some(
    (r) => slugs.includes(r.appSlug) && r.roleLevel >= minLevel,
  );
}

export function canDo(
  session: Session | null,
  appSlug: string,
  featureSlug: string,
  action: string,
): boolean {
  if (!RBAC_ENABLED) return true;
  if (!session) return false;
  if (session.isSuperadmin) return true;
  if (SUPERADMIN_ONLY_NAV_APPS.has(appSlug)) return false;
  if (isManagedModuleForNavApp(session, appSlug)) return true;
  const slugs = rbacAppSlugsForNav(appSlug);
  return session.appRoles
    .filter((r) => slugs.includes(r.appSlug))
    .some((r) => (r.permissions[featureSlug] ?? []).includes(action));
}

export function canRead(
  session: Session | null,
  appSlug: string,
  featureSlug: string,
): boolean {
  return canDo(session, appSlug, featureSlug, 'read');
}

/**
 * Según spec Kiro: rol `module-admin` en el `moduleSlug` dado.
 * Cuando exista app de gestión (`is_management`) sin ese slug de rol, conviene exponer un flag en `/auth/me` y ampliar esta función.
 */
export function isModuleAdmin(
  session: Session | null,
  moduleSlug: string,
): boolean {
  if (!RBAC_ENABLED) return true;
  if (!session) return false;
  if (session.isSuperadmin) return true;
  return session.appRoles.some(
    (r) => r.moduleSlug === moduleSlug && r.roleSlug === 'module-admin',
  );
}
