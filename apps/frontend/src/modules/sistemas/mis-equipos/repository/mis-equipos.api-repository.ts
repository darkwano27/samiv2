import { HTTPError } from 'ky';
import { httpClient } from '@/infrastructure/http/client';
import type { AbAssetRow, AbGlpiUser } from '@/modules/sistemas/asignacion-bienes/repository/asignacion-bienes.api-repository';

const BASE = 'sistemas/mis-equipos';

export async function meFetchMyAssets(): Promise<{ items: AbAssetRow[] }> {
  return httpClient.get(`${BASE}/assets`).json<{ items: AbAssetRow[] }>();
}

export async function meFetchMyGlpiUser(): Promise<AbGlpiUser | null> {
  return httpClient.get(`${BASE}/glpi-user`).json<AbGlpiUser | null>();
}

export async function readMeEquiposApiMessage(e: unknown): Promise<string | undefined> {
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
