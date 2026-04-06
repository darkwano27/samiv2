import { redirect } from '@tanstack/react-router';
import { canAccessApp, canRead } from '@/infrastructure/auth/permissions';
import type { MeResult } from '@/modules/auth/repository/auth.repository';

export function assertAppAccess(session: MeResult, appSlug: string): void {
  if (!canAccessApp(session, appSlug)) {
    throw redirect({ to: '/dashboard' });
  }
}

/** Exige `read` sobre la feature RBAC (además de `assertAppAccess` si aplica). */
export function assertFeatureRead(
  session: MeResult,
  appSlug: string,
  featureSlug: string,
): void {
  if (!canRead(session, appSlug, featureSlug)) {
    throw redirect({ to: '/dashboard' });
  }
}
