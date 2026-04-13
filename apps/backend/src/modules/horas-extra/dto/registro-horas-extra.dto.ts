import { z } from 'zod';
import { REGISTRO_HE_MOTIVOS } from '../registro-horas-extra.constants';

const subdivisionPairSchema = z.object({
  division_code: z.string().min(1).max(24),
  subdivision_code: z.string().min(1).max(24),
});

const motivoCodes = REGISTRO_HE_MOTIVOS.map((m) => m.code) as [string, ...string[]];

/** Acepta `H:mm`, `HH:mm` o `HH:mm:ss` (p. ej. columnas `time` de Postgres) y normaliza a `HH:mm`. */
const timeHm = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t);
  if (!m) return v;
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}, z.string().regex(/^\d{2}:\d{2}$/));

/** Motivo opcional: omitir, null o cadena vacía = sin motivo en persistencia. */
const optionalMotivoCode = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.union([z.null(), z.enum(motivoCodes)]),
);

export const createHeBoletaBodySchema = z.object({
  group_slug: z.string().min(1).max(64),
  division_code: z.string().min(1).max(24),
  subdivision_pairs: z.array(subdivisionPairSchema).min(1).max(80),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Opcional en UI; si no viene, el servidor usa 08:00 / 18:00. */
  time_start: timeHm.optional(),
  time_end: timeHm.optional(),
  motivo_code: optionalMotivoCode,
  lines: z
    .array(
      z.object({
        pernr: z.string().min(1).max(20),
        worker_name: z.string().max(200).optional().nullable(),
        valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        days: z.number().int().min(1).max(366),
        time_start: timeHm,
        time_end: timeHm,
        motivo_code: optionalMotivoCode,
        observaciones: z.string().max(2000).optional().nullable(),
      }),
    )
    .min(1)
    .max(500),
});

export type CreateHeBoletaBody = z.infer<typeof createHeBoletaBodySchema>;
