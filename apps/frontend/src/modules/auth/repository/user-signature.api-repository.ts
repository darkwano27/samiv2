import { httpClient } from '@/infrastructure/http/client';

export type MeSignatureDto = {
  worker_id: string;
  preferred: 'drawn' | 'uploaded' | null;
  has_drawn: boolean;
  has_uploaded: boolean;
  uploaded_mime: string | null;
  effective_data_url: string | null;
  display_name: string;
};

export type PatchMeSignatureBody = {
  drawn_base64?: string | null;
  uploaded_base64?: string | null;
  uploaded_mime?: 'image/png' | 'image/jpeg' | 'image/webp' | null;
  preferred?: 'drawn' | 'uploaded' | null;
};

export async function fetchMeSignature(): Promise<MeSignatureDto> {
  return httpClient.get('auth/me/signature').json<MeSignatureDto>();
}

export async function patchMeSignature(body: PatchMeSignatureBody): Promise<MeSignatureDto> {
  return httpClient.patch('auth/me/signature', { json: body }).json<MeSignatureDto>();
}
