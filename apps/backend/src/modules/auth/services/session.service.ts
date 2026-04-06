import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { SAMI_DB } from '@core/database/database.module';
import * as samiSchema from '@core/database/schema';
import { sessions } from '@core/database/schema/sessions';
import { isSessionEventLoggingEnabled } from '@core/logging/session-event-logging';
import { REDIS_CLIENT } from '@core/redis/redis.module';

export type SessionCreateReason =
  | 'login_ad'
  | 'login_local'
  | 'change_password';

type SessionPayload = { sapCode: string; workerName: string };

function userSessionsIndexKey(sapCode: string): string {
  return `user_sessions:${sapCode}`;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(SAMI_DB) private readonly samiDb: PostgresJsDatabase<typeof samiSchema>,
    private readonly config: ConfigService,
  ) {}

  private sessionLogsEnabled(): boolean {
    const env =
      this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? 'development';
    return isSessionEventLoggingEnabled(env);
  }

  private logSessionEvent(
    level: 'log' | 'warn',
    msg: string,
    ctx: Record<string, string | number | undefined>,
  ): void {
    if (!this.sessionLogsEnabled()) {
      return;
    }
    const line = `${msg} ${Object.entries(ctx)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')}`;
    this.logger[level](line);
  }

  private formatErr(e: unknown): string {
    if (e instanceof Error) {
      return e.message;
    }
    return String(e);
  }

  /** Elimina todas las claves `sess:*` indexadas para este `sapCode` y el set índice. */
  private async revokeAllRedisSessionsForUser(sapCode: string): Promise<void> {
    const indexKey = userSessionsIndexKey(sapCode);
    const ids = await this.redis.smembers(indexKey);
    const pipeline = this.redis.pipeline();
    for (const sid of ids) {
      pipeline.del(`sess:${sid}`);
    }
    pipeline.del(indexKey);
    await pipeline.exec();
  }

  /**
   * Valida token opaco: existe en Redis y no expiró (TTL de la clave).
   */
  /**
   * Cierra una sesión: borra `sess:{token}` y la saca de `user_sessions:{sapCode}`.
   * Idempotente (sin cookie o sesión ya expirada → no-op).
   */
  async revokeSessionByToken(token: string | undefined): Promise<void> {
    const id = token?.trim();
    if (!id) {
      return;
    }
    const redisKey = `sess:${id}`;
    const raw = await this.redis.get(redisKey);
    await this.redis.del(redisKey);
    if (!raw) {
      return;
    }
    try {
      const data = JSON.parse(raw) as Partial<SessionPayload>;
      if (data.sapCode && typeof data.sapCode === 'string') {
        await this.redis.srem(userSessionsIndexKey(data.sapCode), id);
      }
    } catch {
      /* ignore */
    }
    this.logSessionEvent('log', '[session] revoked', {
      session_prefix: id.slice(0, 8),
    });
  }

  async validateSession(
    token: string | undefined,
  ): Promise<SessionPayload | null> {
    const id = token?.trim();
    if (!id) {
      return null;
    }
    const raw = await this.redis.get(`sess:${id}`);
    if (!raw) {
      return null;
    }
    try {
      const data = JSON.parse(raw) as Partial<SessionPayload>;
      if (!data.sapCode || typeof data.sapCode !== 'string') {
        return null;
      }
      return {
        sapCode: data.sapCode,
        workerName:
          typeof data.workerName === 'string' ? data.workerName : '',
      };
    } catch {
      return null;
    }
  }

  /**
   * Crea sesión en Redis + fila de auditoría en PostgreSQL.
   * Invalida sesiones Redis previas del mismo `sapCode` (índice `user_sessions:{sapCode}`).
   */
  async createSession(
    sapCode: string,
    workerName: string,
    reason: SessionCreateReason = 'login_local',
  ): Promise<string> {
    await this.revokeAllRedisSessionsForUser(sapCode);

    const id = randomUUID();
    const ttlMs = this.config.get<number>('SESSION_TTL', 86_400_000);
    const ttlSec = Math.max(1, Math.floor(ttlMs / 1000));
    const expiresAt = new Date(Date.now() + ttlMs);
    const now = new Date();
    const redisKey = `sess:${id}`;
    const indexKey = userSessionsIndexKey(sapCode);
    const idPrefix = id.slice(0, 8);
    const payload: SessionPayload = { sapCode, workerName };

    try {
      await this.redis.setex(redisKey, ttlSec, JSON.stringify(payload));
      await this.redis.sadd(indexKey, id);
      await this.redis.expire(indexKey, ttlSec);
    } catch (e) {
      this.logSessionEvent('warn', '[session] fail', {
        phase: 'redis_setex',
        reason,
        pernr: sapCode,
        session_prefix: idPrefix,
        error: this.formatErr(e),
      });
      throw e;
    }

    try {
      await this.samiDb.insert(sessions).values({
        id,
        sapCode,
        expiresAt,
        createdAt: now,
      });
    } catch (e) {
      this.logSessionEvent('warn', '[session] fail', {
        phase: 'postgres_insert',
        reason,
        pernr: sapCode,
        session_prefix: idPrefix,
        error: this.formatErr(e),
      });
      try {
        await this.redis.del(redisKey);
        await this.redis.srem(indexKey, id);
      } catch {
        /* evitar enmascarar el error principal */
      }
      throw e;
    }

    this.logSessionEvent('log', '[session] ok', {
      reason,
      pernr: sapCode,
      session_prefix: idPrefix,
      ttl_sec: ttlSec,
      expires_at: expiresAt.toISOString(),
    });

    return id;
  }
}
