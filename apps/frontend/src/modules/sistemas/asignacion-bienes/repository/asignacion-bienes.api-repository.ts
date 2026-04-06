import { HTTPError } from 'ky';
import { httpClient } from '@/infrastructure/http/client';

const BASE = 'sistemas/asignacion-bienes';

/** PDF + fotos pueden ser pesados; el default de ky (10s) corta el envío. */
const ACTA_POST_TIMEOUT_MS = 180_000;

export type AbSapWorkerHit = {
  sap_code: string;
  name: string;
  /** SAP staging: `correo_corp` o, si no hay, `correo` (igual que SO / auth). */
  suggested_email: string | null;
};

export type AbGlpiUser = {
  id: number;
  name: string | null;
  firstname: string | null;
  realname: string | null;
  registration_number: string | null;
};

export type AbAssetRow = {
  id: number;
  name: string | null;
  serial: string | null;
  categoria: string | null;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  fecha_asignacion: string | null;
};

export async function abFetchSapSearch(q: string): Promise<{ results: AbSapWorkerHit[] }> {
  const query = q.trim();
  if (query.length === 0) {
    return { results: [] };
  }
  const isNum = /^\d+$/.test(query);
  if (!isNum && query.length < 2) {
    return { results: [] };
  }
  const sp = new URLSearchParams({ q: query });
  return httpClient.get(`${BASE}/sap-search?${sp}`).json<{ results: AbSapWorkerHit[] }>();
}

export async function abFetchGlpiUser(cod: string): Promise<AbGlpiUser | null> {
  const id = cod.trim();
  if (!id) return null;
  return httpClient
    .get(`${BASE}/glpi-user/${encodeURIComponent(id)}`)
    .json<AbGlpiUser | null>();
}

export async function abFetchAssets(cod: string): Promise<{ items: AbAssetRow[] }> {
  const id = cod.trim();
  if (!id) return { items: [] };
  return httpClient
    .get(`${BASE}/assets/${encodeURIComponent(id)}`)
    .json<{ items: AbAssetRow[] }>();
}

/** Datos org. SAP para el PDF (subdivisión, división, cargo, jefe). */
export type AbSapWorkerOrg = {
  subdivision: string | null;
  division: string | null;
  cargo: string | null;
  jefe: string | null;
  /** Nombre y apellido del jefe (mismo maestro SAP que `jefe`). */
  jefe_nombre: string | null;
};

export async function abFetchSapWorkerOrg(cod: string): Promise<AbSapWorkerOrg | null> {
  const id = cod.trim();
  if (!id) return null;
  return httpClient
    .get(`${BASE}/sap-org/${encodeURIComponent(id)}`)
    .json<AbSapWorkerOrg | null>();
}

export async function abUploadPdfToSharepoint(body: {
  pdf_base64: string;
  file_name: string;
  worker_code: string;
}): Promise<{ webUrl: string }> {
  return httpClient.post(`${BASE}/sharepoint-upload`, { json: body }).json<{ webUrl: string }>();
}

/** Cuerpo del acta (PDF / correo / SharePoint); debe coincidir con el backend. */
export type AbActaBienesBody = {
  report_kind: 'entrega' | 'devolucion';
  act_date: string;
  worker_sap: string;
  worker_name: string;
  glpi_user_label?: string | null;
  oracle_user?: {
    usuario?: string | null;
    subdivision?: string | null;
    division?: string | null;
    cargo?: string | null;
    /** Código SAP del jefe (pernr). */
    jefe?: string | null;
    jefe_nombre?: string | null;
  } | null;
  glpi_registration_number?: string | null;
  glpi_firstname?: string | null;
  glpi_realname?: string | null;
  technician_name?: string | null;
  technician_signature_png_base64?: string | null;
  additional_signer?: { sap_code: string; name: string } | null;
  /** Vacío si no hay firma (opcional en el PDF). */
  signature_png_base64: string;
  assets: {
    id: number;
    name?: string | null;
    serial?: string | null;
    categoria?: string | null;
    tipo?: string | null;
    marca?: string | null;
    modelo?: string | null;
    fecha_asignacion?: string | null;
    comentario?: string;
  }[];
  photos: { mime: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string }[];
};

export async function abPostActaPdf(
  body: AbActaBienesBody,
): Promise<{ pdf_base64: string; file_name: string }> {
  return httpClient
    .post(`${BASE}/acta/pdf`, { json: body, timeout: ACTA_POST_TIMEOUT_MS })
    .json<{
      pdf_base64: string;
      file_name: string;
    }>();
}

export async function abPostActaEmail(
  body: AbActaBienesBody & { to: string },
): Promise<{ ok: true }> {
  return httpClient
    .post(`${BASE}/acta/email`, { json: body, timeout: ACTA_POST_TIMEOUT_MS })
    .json<{ ok: true }>();
}

/** Genera el PDF en servidor y lo sube a SharePoint en un solo paso. */
export async function abPostActaSharepoint(body: AbActaBienesBody): Promise<{ webUrl: string }> {
  return httpClient
    .post(`${BASE}/acta/sharepoint`, { json: body, timeout: ACTA_POST_TIMEOUT_MS })
    .json<{ webUrl: string }>();
}

export async function readAbApiMessage(e: unknown): Promise<string | undefined> {
  if (!(e instanceof HTTPError)) return undefined;
  try {
    const b = (await e.response.json()) as { message?: string | string[] };
    if (typeof b.message === 'string') return b.message;
    if (Array.isArray(b.message)) return b.message.join(', ');
  } catch {
    /* ignore */
  }
  return undefined;
}
