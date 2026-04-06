import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@core/redis/redis.module';
import type { CachedPermissions } from '../types/rbac-cache.types';
import { RbacService } from './rbac.service';

const CACHE_TTL_SECONDS = 300;

function normalizeCachedPermissions(raw: unknown): CachedPermissions {
  const p = raw as Partial<CachedPermissions>;
  return {
    workerId: p.workerId ?? '',
    isSuperadmin: Boolean(p.isSuperadmin),
    managedModuleSlugs: Array.isArray(p.managedModuleSlugs)
      ? p.managedModuleSlugs
      : [],
    assignments: Array.isArray(p.assignments) ? p.assignments : [],
  };
}

@Injectable()
export class PermissionCacheService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly rbacService: RbacService,
  ) {}

  private key(workerId: string): string {
    return `rbac:perms:${workerId}`;
  }

  async getOrResolve(workerId: string): Promise<CachedPermissions> {
    const raw = await this.redis.get(this.key(workerId));
    if (raw) {
      return normalizeCachedPermissions(JSON.parse(raw) as unknown);
    }
    const resolved = await this.rbacService.resolvePermissions(workerId);
    await this.redis.set(
      this.key(workerId),
      JSON.stringify(resolved),
      'EX',
      CACHE_TTL_SECONDS,
    );
    return resolved;
  }

  async invalidate(workerId: string): Promise<void> {
    await this.redis.del(this.key(workerId));
  }

  async invalidateByRole(roleId: string): Promise<void> {
    const workerIds = await this.rbacService.getWorkerIdsByRole(roleId);
    if (workerIds.length === 0) return;
    await this.redis.del(...workerIds.map((id) => this.key(id)));
  }
}
