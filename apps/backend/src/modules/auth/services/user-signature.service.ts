import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { SAMI_DB } from '@core/database/database.module';
import * as samiSchema from '@core/database/schema';
import { workers } from '@core/database/schema/workers';
import { workerSignatures } from '@core/database/schema/worker-signatures';
import { SessionService } from './session.service';
import type { PatchUserSignatureBody } from '../user-signature.schemas';

type SigRow = InferSelectModel<typeof workerSignatures>;

function stripDataUrlBase64(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  const m = /^data:[^;]+;base64,(.+)$/i.exec(t);
  if (m?.[1]) return m[1].replace(/\s/g, '');
  return t.replace(/\s/g, '');
}

function effectiveDataUrl(row: SigRow | undefined): string | null {
  if (!row) return null;
  const pickDrawn = () =>
    row.drawnBase64 ? `data:image/png;base64,${row.drawnBase64}` : null;
  const pickUploaded = () =>
    row.uploadedBase64 && row.uploadedMime
      ? `data:${row.uploadedMime};base64,${row.uploadedBase64}`
      : null;

  if (row.preferred === 'uploaded') {
    return pickUploaded() ?? pickDrawn();
  }
  if (row.preferred === 'drawn') {
    return pickDrawn() ?? pickUploaded();
  }
  return pickDrawn() ?? pickUploaded();
}

@Injectable()
export class UserSignatureService {
  constructor(
    @Inject(SAMI_DB)
    private readonly db: PostgresJsDatabase<typeof samiSchema>,
    private readonly sessions: SessionService,
  ) {}

  private async requireSession(token: string | undefined) {
    const session = await this.sessions.validateSession(token);
    if (!session) {
      throw new UnauthorizedException({ message: 'No autenticado' });
    }
    return session;
  }

  private async ensureWorkerRow(workerId: string, displayName: string) {
    await this.db
      .insert(workers)
      .values({
        id: workerId.trim(),
        name: displayName.trim() || `Worker ${workerId}`,
      })
      .onConflictDoUpdate({
        target: workers.id,
        set: {
          name: displayName.trim() || `Worker ${workerId}`,
          updatedAt: new Date(),
        },
      });
  }

  async getForSessionToken(token: string | undefined) {
    const session = await this.requireSession(token);
    const sap = session.sapCode;
    const workerName = session.workerName ?? sap;

    const [row] = await this.db
      .select()
      .from(workerSignatures)
      .where(eq(workerSignatures.workerId, sap))
      .limit(1);

    return {
      worker_id: sap,
      preferred: (row?.preferred as 'drawn' | 'uploaded' | null) ?? null,
      has_drawn: Boolean(row?.drawnBase64),
      has_uploaded: Boolean(row?.uploadedBase64 && row?.uploadedMime),
      uploaded_mime: row?.uploadedMime ?? null,
      effective_data_url: effectiveDataUrl(row),
      /** Nombre para recuadros de firma en PDF (operador logueado). */
      display_name: workerName,
    };
  }

  async patchForSessionToken(token: string | undefined, body: PatchUserSignatureBody) {
    const session = await this.requireSession(token);
    const sap = session.sapCode;
    const workerName = session.workerName ?? sap;

    await this.ensureWorkerRow(sap, workerName);

    const [existing] = await this.db
      .select()
      .from(workerSignatures)
      .where(eq(workerSignatures.workerId, sap))
      .limit(1);

    let drawn =
      body.drawn_base64 !== undefined
        ? stripDataUrlBase64(body.drawn_base64)
        : (existing?.drawnBase64 ?? null);
    let uploaded =
      body.uploaded_base64 !== undefined
        ? stripDataUrlBase64(body.uploaded_base64)
        : (existing?.uploadedBase64 ?? null);
    let mime =
      body.uploaded_mime !== undefined ? body.uploaded_mime : (existing?.uploadedMime ?? null);
    let preferred =
      body.preferred !== undefined ? body.preferred : (existing?.preferred ?? null);

    if (drawn === '') drawn = null;
    if (uploaded === '') uploaded = null;

    if (preferred === 'drawn' && !drawn) {
      preferred = uploaded && mime ? 'uploaded' : null;
    }
    if (preferred === 'uploaded' && (!uploaded || !mime)) {
      preferred = drawn ? 'drawn' : null;
    }

    if (body.preferred === 'uploaded' && uploaded && !mime) {
      throw new BadRequestException({
        message: 'Para usar la imagen subida indicá también uploaded_mime (png, jpeg o webp).',
      });
    }

    const now = new Date();
    await this.db
      .insert(workerSignatures)
      .values({
        workerId: sap,
        drawnBase64: drawn,
        uploadedBase64: uploaded,
        uploadedMime: mime,
        preferred,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: workerSignatures.workerId,
        set: {
          drawnBase64: drawn,
          uploadedBase64: uploaded,
          uploadedMime: mime,
          preferred,
          updatedAt: now,
        },
      });

    const [row] = await this.db
      .select()
      .from(workerSignatures)
      .where(eq(workerSignatures.workerId, sap))
      .limit(1);

    return {
      worker_id: sap,
      preferred: (row?.preferred as 'drawn' | 'uploaded' | null) ?? null,
      has_drawn: Boolean(row?.drawnBase64),
      has_uploaded: Boolean(row?.uploadedBase64 && row?.uploadedMime),
      uploaded_mime: row?.uploadedMime ?? null,
      effective_data_url: effectiveDataUrl(row),
      display_name: workerName,
    };
  }

  /**
   * Firma guardada en Mi firma para otro trabajador (p. ej. PDF de boleta HE firmado por el aprobador).
   */
  async getSignatureForPdf(workerId: string): Promise<{
    display_name: string;
    effective_data_url: string | null;
  }> {
    const id = workerId.trim();
    const [w] = await this.db
      .select({ name: workers.name })
      .from(workers)
      .where(eq(workers.id, id))
      .limit(1);
    const [row] = await this.db
      .select()
      .from(workerSignatures)
      .where(eq(workerSignatures.workerId, id))
      .limit(1);
    return {
      display_name: (w?.name ?? '').trim() || id,
      effective_data_url: effectiveDataUrl(row),
    };
  }
}
