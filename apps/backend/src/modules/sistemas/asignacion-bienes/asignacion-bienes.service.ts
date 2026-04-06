import {
  Inject,
  Injectable,
  OnModuleDestroy,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { createPool } from 'mysql2/promise';
import { eq, ilike, or } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { SAP_DB } from '@core/database/database.module';
import { eiisTrabajadores } from '@core/database/schema-sap/eiis-trabajadores';
import * as sapSchema from '@core/database/schema-sap';
import { ModuleGlpiService } from '@core/glpi/module-glpi.service';
import {
  GLPI_SQL_ASSETS_BY_USER_ID,
  GLPI_SQL_USER_BY_REGISTRATION,
  MODULE_SLUG_SISTEMAS,
} from './asignacion-bienes.constants';

const SAP_STAT_ACTIVO = 3;

function isTrabajadorActivoStat(stat2: string | null | undefined): boolean {
  return Number(String(stat2 ?? '').trim()) === SAP_STAT_ACTIVO;
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

function formatStagingWorkerName(
  vorna: string | null | undefined,
  nachn: string | null | undefined,
): string {
  return `${(vorna ?? '').trim()} ${(nachn ?? '').trim()}`.trim();
}

/**
 * Misma regla que identificación de usuario (AuthService / SO): corporativo si existe, si no personal.
 * No usar `getMe()` del operador para el destinatario del PDF.
 */
function suggestedWorkerEmail(row: {
  correoCorp: string | null | undefined;
  correo: string | null | undefined;
}): string | null {
  const corp = row.correoCorp?.trim();
  if (corp) return corp;
  const personal = row.correo?.trim();
  return personal || null;
}

export type SapWorkerSearchHit = {
  sap_code: string;
  name: string;
  /** `correo_corp` del staging SAP; si vacío, `correo` personal. */
  suggested_email: string | null;
};

export type GlpiUserInfoDto = {
  id: number;
  name: string | null;
  firstname: string | null;
  realname: string | null;
  registration_number: string | null;
};

export type GlpiAssetRowDto = {
  id: number;
  name: string | null;
  serial: string | null;
  categoria: string | null;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  fecha_asignacion: string | null;
};

/** Fila vigente SAP (`eiis_trabajadores`) para el PDF v1 (DATOS DE USUARIO). */
export type SapWorkerOrgDto = {
  subdivision: string | null;
  division: string | null;
  cargo: string | null;
  /** Código SAP del jefe (pernr). */
  jefe: string | null;
  /** Nombre y apellido del jefe resueltos por `jefe` → maestro SAP. */
  jefe_nombre: string | null;
};

@Injectable()
export class AsignacionBienesService implements OnModuleDestroy {
  private mysqlPool: Pool | null = null;
  private mysqlPoolKey: string | null = null;

  constructor(
    @Optional()
    @Inject(SAP_DB)
    private readonly sapDb: PostgresJsDatabase<typeof sapSchema> | null,
    private readonly moduleGlpi: ModuleGlpiService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.mysqlPool?.end().catch(() => {});
    this.mysqlPool = null;
    this.mysqlPoolKey = null;
  }

  private pickBestStagingRowForPernr(
    rows: (typeof eiisTrabajadores.$inferSelect)[],
    pernr: string,
  ): (typeof eiisTrabajadores.$inferSelect) | null {
    const code = pernr.trim();
    if (!code) return null;
    const byPernr = new Map<string, (typeof rows)[0]>();
    for (const row of rows) {
      const key = row.pernr.trim();
      if (!key) continue;
      const prev = byPernr.get(key);
      if (!prev || compareStagingRows(row, prev) > 0) {
        byPernr.set(key, row);
      }
    }
    return byPernr.get(code) ?? null;
  }

  /**
   * SAP (PostgreSQL): por código numérico o nombre; máx. 15; activos (`stat2=3`) primero.
   */
  async searchSap(qRaw: string): Promise<{ results: SapWorkerSearchHit[] }> {
    if (!this.sapDb) {
      return { results: [] };
    }
    const q = qRaw.trim();
    if (q.length === 0) {
      return { results: [] };
    }
    const isNumericOnly = /^\d+$/.test(q);
    if (!isNumericOnly && q.length < 2) {
      return { results: [] };
    }

    const pattern = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;

    const rows = await this.sapDb
      .select()
      .from(eiisTrabajadores)
      .where(
        isNumericOnly
          ? or(eq(eiisTrabajadores.pernr, q), ilike(eiisTrabajadores.pernr, `${q}%`))
          : or(
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

    const results: SapWorkerSearchHit[] = sorted.slice(0, 15).map((w) => {
      const name =
        formatStagingWorkerName(w.vorna, w.nachn).trim() || w.pernr.trim();
      return {
        sap_code: w.pernr.trim(),
        name,
        suggested_email: suggestedWorkerEmail(w),
      };
    });
    return { results };
  }

  /**
   * SAP (PostgreSQL staging): subdivisión, división, cargo y código del jefe para el acta.
   * Usa la misma deduplicación por `pernr` + vigencia (`begda`) que la búsqueda.
   */
  async getSapWorkerOrgSnapshot(cod: string): Promise<SapWorkerOrgDto | null> {
    if (!this.sapDb) {
      return null;
    }
    const code = cod.trim();
    if (!code) return null;
    try {
      const rows = await this.sapDb
        .select()
        .from(eiisTrabajadores)
        .where(eq(eiisTrabajadores.pernr, code))
        .limit(80);
      const row = this.pickBestStagingRowForPernr(rows, code);
      if (!row) return null;
      const jefeCode = row.jefe?.trim() || null;
      let jefeNombre: string | null = null;
      if (jefeCode) {
        try {
          const jefeRows = await this.sapDb
            .select()
            .from(eiisTrabajadores)
            .where(eq(eiisTrabajadores.pernr, jefeCode))
            .limit(80);
          const jefeRow = this.pickBestStagingRowForPernr(jefeRows, jefeCode);
          if (jefeRow) {
            const n = formatStagingWorkerName(jefeRow.vorna, jefeRow.nachn).trim();
            jefeNombre = n || null;
          }
        } catch {
          /* ignore jefe lookup */
        }
      }
      return {
        subdivision: row.txtSubdiv?.trim() || null,
        division: row.txtDiv?.trim() || null,
        cargo: row.stext?.trim() || null,
        jefe: jefeCode,
        jefe_nombre: jefeNombre,
      };
    } catch {
      return null;
    }
  }

  private async getMysqlPool(): Promise<Pool> {
    const creds = await this.moduleGlpi.getResolvedReadonlyCredentials(MODULE_SLUG_SISTEMAS);
    if (!creds) {
      throw new ServiceUnavailableException({
        message:
          'GLPI MySQL no configurado para el módulo sistemas (Ajustes → GLPI) o falta SETTINGS_ENCRYPTION_KEY.',
      });
    }
    const key = `${creds.host}:${creds.port}:${creds.user}:${creds.database}`;
    if (this.mysqlPool && this.mysqlPoolKey === key) {
      return this.mysqlPool;
    }
    await this.mysqlPool?.end().catch(() => {});
    this.mysqlPool = createPool({
      host: creds.host,
      port: creds.port,
      user: creds.user,
      password: creds.password,
      database: creds.database,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 12_000,
    });
    this.mysqlPoolKey = key;
    return this.mysqlPool;
  }

  /**
   * GLPI (MySQL): usuario por `registration_number` (= código trabajador SAP).
   */
  async getGlpiUserInfo(cod: string): Promise<GlpiUserInfoDto | null> {
    const code = cod.trim();
    if (!code) return null;
    try {
      const pool = await this.getMysqlPool();
      const [rows] = await pool.query<RowDataPacket[]>(GLPI_SQL_USER_BY_REGISTRATION, [
        code,
      ]);
      const row = rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        id: Number(row.id),
        name: row.name != null ? String(row.name) : null,
        firstname: row.firstname != null ? String(row.firstname) : null,
        realname: row.realname != null ? String(row.realname) : null,
        registration_number:
          row.registration_number != null ? String(row.registration_number) : null,
      };
    } catch {
      return null;
    }
  }

  /**
   * GLPI (MySQL): activos del usuario (máx. 50, fecha asignación desc).
   */
  async getAssetsByWorkerCode(cod: string): Promise<{ items: GlpiAssetRowDto[] }> {
    const code = cod.trim();
    if (!code) {
      return { items: [] };
    }
    const glpiUser = await this.getGlpiUserInfo(code);
    if (!glpiUser) {
      return { items: [] };
    }
    const pool = await this.getMysqlPool();
    const [rows] = await pool.query<RowDataPacket[]>(GLPI_SQL_ASSETS_BY_USER_ID, [
      glpiUser.id,
    ]);
    const items: GlpiAssetRowDto[] = (rows ?? []).map((r) => ({
      id: Number(r.id),
      name: r.name != null ? String(r.name) : null,
      serial: r.serial != null ? String(r.serial) : null,
      categoria: r.categoria != null ? String(r.categoria) : null,
      tipo: r.tipo != null ? String(r.tipo) : null,
      marca: r.marca != null ? String(r.marca) : null,
      modelo: r.modelo != null ? String(r.modelo) : null,
      fecha_asignacion: formatMysqlDate(r.fecha_asignacion),
    }));
    return { items };
  }
}

function formatMysqlDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  return String(v);
}
