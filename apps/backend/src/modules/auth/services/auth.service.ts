import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import {
  and,
  desc,
  eq,
  gt,
  isNotNull,
  type InferSelectModel,
} from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { SAMI_DB, SAP_DB } from '@core/database/database.module';
import * as samiSchema from '@core/database/schema';
import * as sapSchema from '@core/database/schema-sap';
import { localAuth } from '@core/database/schema/local-auth';
import { isSessionEventLoggingEnabled } from '@core/logging/session-event-logging';
import { eiisDivisiones } from '@core/database/schema-sap/eiis-divisiones';
import { eiisSubdivisiones } from '@core/database/schema-sap/eiis-subdivisiones';
import { eiisTrabajadores } from '@core/database/schema-sap/eiis-trabajadores';
import { PermissionCacheService } from '@modules/rbac/services/permission-cache.service';
import { LdapService } from './ldap.service';
import { EmailService } from './email.service';
import { SessionService } from './session.service';

const TEMP_TOKEN_TTL_MS = 10 * 60 * 1000;
const SAP_STAT_ACTIVO = 3;
/** Tras N fallos seguidos de contraseña (login local), se bloquea la cuenta un tiempo. */
const LOCAL_LOGIN_MAX_FAILED_ATTEMPTS = 5;
const LOCAL_LOGIN_LOCKOUT_MS = 30 * 60 * 1000;

type StagingWorkerRow = InferSelectModel<typeof eiisTrabajadores>;

export type MeOrgUnit = { code: string; name: string | null };

/** Fragmento de `GET /auth/me` alineado a `.kiro/specs/sami-rbac/design.md`. */
export type MeAppRole = {
  app_slug: string;
  module_slug: string;
  role_slug: string;
  role_level: number;
  scope: 'global' | 'division' | 'subdivision';
  scope_id: string | null;
  permissions: Record<string, string[]>;
};

const TEMP_PW_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generateTempPassword(): string {
  const bytes = randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) {
    s += TEMP_PW_ALPHABET[bytes[i]! % TEMP_PW_ALPHABET.length]!;
  }
  return s;
}

function formatWorkerName(nombre: string, apellidoPaterno: string): string {
  const first = nombre.trim().split(/\s+/)[0] ?? '';
  const lastInitial = apellidoPaterno.trim().charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`.trim();
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return '**@**';
  const prefix = user.slice(0, 2);
  return `${prefix}***@${domain}`;
}

function hasCorreoCorp(correoCorp: string | null | undefined): boolean {
  return Boolean(correoCorp?.trim());
}

function isTrabajadorActivo(stat2: string | number): boolean {
  const n = Number(String(stat2).trim());
  return n === SAP_STAT_ACTIVO;
}

function normalizeDni(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(SAMI_DB)
    private readonly samiDb: PostgresJsDatabase<typeof samiSchema>,
    @Optional()
    @Inject(SAP_DB)
    private readonly sapDb: PostgresJsDatabase<typeof sapSchema> | null,
    private readonly ldap: LdapService,
    private readonly email: EmailService,
    private readonly sessions: SessionService,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  private requireSap(): PostgresJsDatabase<typeof sapSchema> {
    if (!this.sapDb) {
      throw new ServiceUnavailableException('SAP staging no disponible');
    }
    return this.sapDb;
  }

  private authSessionLogsEnabled(): boolean {
    return isSessionEventLoggingEnabled(process.env.NODE_ENV);
  }

  /**
   * División/subdivisión desde catálogo SAP + fallback `txt_*` en trabajador.
   * Ver `docs/features/auth-me-organization-enrichment.md`.
   */
  private async resolveDivisionForMe(
    sap: PostgresJsDatabase<typeof sapSchema>,
    w: StagingWorkerRow,
  ): Promise<MeOrgUnit | null> {
    const code = w.werks?.trim() || null;
    if (!code) return null;
    const [row] = await sap
      .select()
      .from(eiisDivisiones)
      .where(eq(eiisDivisiones.codigoDivision, code))
      .limit(1);
    const name =
      row?.nombreDivision?.trim() || w.txtDiv?.trim() || null;
    return { code, name };
  }

  private async resolveSubdivisionForMe(
    sap: PostgresJsDatabase<typeof sapSchema>,
    w: StagingWorkerRow,
  ): Promise<MeOrgUnit | null> {
    const code = w.btrtl?.trim() || null;
    if (!code) return null;
    const [row] = await sap
      .select()
      .from(eiisSubdivisiones)
      .where(eq(eiisSubdivisiones.codigoSubdivision, code))
      .limit(1);
    const name =
      row?.nombreSubdivision?.trim() || w.txtSubdiv?.trim() || null;
    return { code, name };
  }

  /** sapCode en API = `pernr` en `eiis_trabajadores` */
  private async getStagingWorker(sapCode: string) {
    const sap = this.requireSap();
    const rows = await sap
      .select()
      .from(eiisTrabajadores)
      .where(eq(eiisTrabajadores.pernr, sapCode))
      .orderBy(desc(eiisTrabajadores.begda), desc(eiisTrabajadores.idRegistro))
      .limit(1);
    return rows[0] ?? null;
  }

  async identify(sapCode: string) {
    const w = await this.getStagingWorker(sapCode);
    if (!w) {
      throw new NotFoundException({ message: 'Código no registrado' });
    }
    if (!isTrabajadorActivo(w.stat2)) {
      throw new ForbiddenException({ message: 'Cuenta inactiva' });
    }
    const display = formatWorkerName(w.vorna ?? '', w.nachn ?? '');

    if (hasCorreoCorp(w.correoCorp)) {
      return {
        found: true as const,
        auth_type: 'ad' as const,
        worker_name: display,
      };
    }

    const [local] = await this.samiDb
      .select()
      .from(localAuth)
      .where(eq(localAuth.sapCode, sapCode))
      .limit(1);

    if (local) {
      return {
        found: true as const,
        auth_type: 'local' as const,
        worker_name: display,
      };
    }

    return {
      found: true as const,
      auth_type: 'new-local' as const,
      worker_name: display,
    };
  }

  async login(sapCode: string, password: string) {
    const w = await this.getStagingWorker(sapCode);
    if (!w) {
      throw new UnauthorizedException({ message: 'Credenciales incorrectas' });
    }
    if (!isTrabajadorActivo(w.stat2)) {
      throw new ForbiddenException({ message: 'Cuenta inactiva' });
    }

    const workerDisplay = formatWorkerName(w.vorna ?? '', w.nachn ?? '');

    if (hasCorreoCorp(w.correoCorp)) {
      try {
        await this.ldap.authenticateBySapCode(sapCode, password);
      } catch {
        throw new UnauthorizedException({ message: 'Credenciales incorrectas' });
      }
      const token = await this.sessions.createSession(
        sapCode,
        workerDisplay,
        'login_ad',
      );
      return {
        requires_password_change: false as const,
        token,
      };
    }

    const [row] = await this.samiDb
      .select()
      .from(localAuth)
      .where(eq(localAuth.sapCode, sapCode))
      .limit(1);

    if (!row) {
      throw new UnauthorizedException({ message: 'Credenciales incorrectas' });
    }

    const lockedUntil = row.lockedUntil ? new Date(row.lockedUntil) : null;
    const nowMs = Date.now();
    if (lockedUntil && lockedUntil.getTime() > nowMs) {
      throw new ForbiddenException({
        message:
          'Cuenta bloqueada por intentos fallidos. Esperá el desbloqueo automático o pedí a un administrador que la desbloquee desde Gestión de usuarios.',
      });
    }

    let failedAttempts = row.failedLoginAttempts ?? 0;
    if (lockedUntil && lockedUntil.getTime() <= nowMs) {
      failedAttempts = 0;
      await this.samiDb
        .update(localAuth)
        .set({
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(localAuth.sapCode, sapCode));
    }

    const ok = await argon2.verify(row.passwordHash, password);
    if (!ok) {
      const attempts = failedAttempts + 1;
      await this.samiDb
        .update(localAuth)
        .set({
          failedLoginAttempts: attempts,
          lockedUntil:
            attempts >= LOCAL_LOGIN_MAX_FAILED_ATTEMPTS
              ? new Date(Date.now() + LOCAL_LOGIN_LOCKOUT_MS)
              : null,
          updatedAt: new Date(),
        })
        .where(eq(localAuth.sapCode, sapCode));
      throw new UnauthorizedException({ message: 'Credenciales incorrectas' });
    }

    await this.samiDb
      .update(localAuth)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(localAuth.sapCode, sapCode));

    if (!row.isTempPassword) {
      const token = await this.sessions.createSession(
        sapCode,
        workerDisplay,
        'login_local',
      );
      return {
        requires_password_change: false as const,
        token,
      };
    }

    const tempToken = randomUUID();
    const expires = new Date(Date.now() + TEMP_TOKEN_TTL_MS);
    await this.samiDb
      .update(localAuth)
      .set({
        tempToken,
        tempTokenExpiresAt: expires,
        updatedAt: new Date(),
      })
      .where(eq(localAuth.sapCode, sapCode));

    if (this.authSessionLogsEnabled()) {
      this.logger.log(
        `[auth] login_ok pernr=${sapCode} outcome=password_change_required session=none temp_prefix=${tempToken.slice(0, 8)}`,
      );
    }

    return {
      requires_password_change: true as const,
      temp_token: tempToken,
    };
  }

  async register(sapCode: string, dni: string) {
    const w = await this.getStagingWorker(sapCode);
    if (!w) {
      throw new BadRequestException({ message: 'DNI incorrecto' });
    }
    if (!isTrabajadorActivo(w.stat2)) {
      throw new ForbiddenException({ message: 'Cuenta inactiva' });
    }
    if (hasCorreoCorp(w.correoCorp)) {
      throw new BadRequestException({ message: 'DNI incorrecto' });
    }
    if (normalizeDni(w.perid) !== normalizeDni(dni)) {
      throw new BadRequestException({ message: 'DNI incorrecto' });
    }

    const correoPersonal = w.correo?.trim();
    if (!correoPersonal) {
      throw new BadRequestException({
        message: 'No hay correo personal registrado en SAP para este trabajador',
      });
    }

    const [existing] = await this.samiDb
      .select()
      .from(localAuth)
      .where(eq(localAuth.sapCode, sapCode))
      .limit(1);
    if (existing) {
      throw new ConflictException({ message: 'Worker ya registrado' });
    }

    const plain = generateTempPassword();
    const passwordHash = await argon2.hash(plain);
    await this.samiDb.insert(localAuth).values({
      sapCode,
      passwordHash,
      isTempPassword: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.email.sendTempPassword(correoPersonal, plain, sapCode);

    return {
      masked_email: maskEmail(correoPersonal),
      message: 'Revisa tu correo para la contraseña temporal.',
    };
  }

  async recover(sapCode: string, dni: string) {
    const w = await this.getStagingWorker(sapCode);
    if (!w) {
      throw new BadRequestException({ message: 'DNI incorrecto' });
    }
    if (!isTrabajadorActivo(w.stat2)) {
      throw new ForbiddenException({ message: 'Cuenta inactiva' });
    }
    if (hasCorreoCorp(w.correoCorp)) {
      throw new ForbiddenException({
        message: 'Los usuarios corporativos no pueden recuperar contraseña desde SAMI',
      });
    }
    if (normalizeDni(w.perid) !== normalizeDni(dni)) {
      throw new BadRequestException({ message: 'DNI incorrecto' });
    }

    const correoPersonal = w.correo?.trim();
    if (!correoPersonal) {
      throw new BadRequestException({
        message: 'No hay correo personal registrado en SAP para este trabajador',
      });
    }

    const [row] = await this.samiDb
      .select()
      .from(localAuth)
      .where(eq(localAuth.sapCode, sapCode))
      .limit(1);
    if (!row) {
      throw new BadRequestException({ message: 'DNI incorrecto' });
    }

    const plain = generateTempPassword();
    const passwordHash = await argon2.hash(plain);
    await this.samiDb
      .update(localAuth)
      .set({
        passwordHash,
        isTempPassword: true,
        tempToken: null,
        tempTokenExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(localAuth.sapCode, sapCode));

    await this.email.sendTempPassword(correoPersonal, plain, sapCode);

    return {
      masked_email: maskEmail(correoPersonal),
      message: 'Revisa tu correo para la contraseña temporal.',
    };
  }

  async changePassword(tempToken: string, newPassword: string) {
    const [row] = await this.samiDb
      .select()
      .from(localAuth)
      .where(
        and(
          eq(localAuth.tempToken, tempToken),
          isNotNull(localAuth.tempTokenExpiresAt),
          gt(localAuth.tempTokenExpiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row) {
      throw new UnauthorizedException({ message: 'Token inválido o expirado' });
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.samiDb
      .update(localAuth)
      .set({
        passwordHash,
        isTempPassword: false,
        tempToken: null,
        tempTokenExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(localAuth.sapCode, row.sapCode));

    let workerDisplay = '';
    try {
      const w = await this.getStagingWorker(row.sapCode);
      if (w) {
        workerDisplay = formatWorkerName(w.vorna ?? '', w.nachn ?? '');
      }
    } catch {
      workerDisplay = row.sapCode;
    }

    const token = await this.sessions.createSession(
      row.sapCode,
      workerDisplay || row.sapCode,
      'change_password',
    );
    return { token };
  }

  /**
   * Sesión actual vía cookie `sami_session` + Redis (validado en `SessionService`).
   */
  async getMeFromSessionToken(token: string | undefined) {
    const session = await this.sessions.validateSession(token);
    if (!session) {
      throw new UnauthorizedException({ message: 'No autenticado' });
    }

    let division: MeOrgUnit | null = null;
    let subdivision: MeOrgUnit | null = null;
    if (this.sapDb) {
      try {
        const w = await this.getStagingWorker(session.sapCode);
        if (w) {
          const sap = this.sapDb;
          [division, subdivision] = await Promise.all([
            this.resolveDivisionForMe(sap, w),
            this.resolveSubdivisionForMe(sap, w),
          ]);
        }
      } catch (err) {
        this.logger.warn(
          `[auth] getMe org enrichment failed sap=${session.sapCode}: ${String(err)}`,
        );
      }
    }

    let is_superadmin = false;
    let app_roles: MeAppRole[] = [];
    let managed_module_slugs: string[] = [];
    try {
      const cached = await this.permissionCache.getOrResolve(session.sapCode);
      is_superadmin = cached.isSuperadmin;
      managed_module_slugs = cached.managedModuleSlugs ?? [];
      app_roles = cached.assignments.map((a) => ({
        app_slug: a.appSlug,
        module_slug: a.moduleSlug,
        role_slug: a.roleSlug,
        role_level: a.roleLevel,
        scope: a.scope,
        scope_id: a.scopeId,
        permissions: a.permissions,
      }));
    } catch (err) {
      this.logger.warn(
        `[auth] getMe RBAC cache failed sap=${session.sapCode}: ${String(err)}`,
      );
    }

    return {
      sap_code: session.sapCode,
      worker_name: session.workerName,
      worker_id: session.sapCode,
      division,
      subdivision,
      is_superadmin,
      app_roles,
      managed_module_slugs,
    };
  }

  async logout(token: string | undefined) {
    const session = await this.sessions.validateSession(token);
    const sapCode = session?.sapCode;
    await this.sessions.revokeSessionByToken(token);
    if (sapCode) {
      await this.permissionCache.invalidate(sapCode);
    }
  }
}
