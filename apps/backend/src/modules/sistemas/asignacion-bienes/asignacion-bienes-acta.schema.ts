import { z } from 'zod';

const actaAssetSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().nullable().optional(),
  serial: z.string().nullable().optional(),
  categoria: z.string().nullable().optional(),
  tipo: z.string().nullable().optional(),
  marca: z.string().nullable().optional(),
  modelo: z.string().nullable().optional(),
  fecha_asignacion: z.string().nullable().optional(),
  comentario: z.string().max(4000).optional().default(''),
});

const actaPhotoSchema = z.object({
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  base64: z.string().min(1).max(16_000_000),
});

const additionalSignerSchema = z.object({
  sap_code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
});

/** Subdivisión, división, cargo y código SAP del jefe (maestro SAP / Postgres staging). */
const sapOrgUserSchema = z.object({
  usuario: z.string().max(300).nullable().optional(),
  subdivision: z.string().max(300).nullable().optional(),
  division: z.string().max(300).nullable().optional(),
  cargo: z.string().max(300).nullable().optional(),
  /** Código SAP (pernr) del jefe inmediato, ej. 72255. */
  jefe: z.string().max(32).nullable().optional(),
  /** Nombre y apellido del jefe (resuelto en servidor desde `jefe`). */
  jefe_nombre: z.string().max(300).nullable().optional(),
});

/** Cuerpo para generar PDF / enviar correo (misma forma que arma el frontend). */
export const actaBienesBodySchema = z.object({
  report_kind: z.enum(['entrega', 'devolucion']),
  act_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  worker_sap: z.string().min(1).max(32),
  worker_name: z.string().min(1).max(200),
  glpi_user_label: z.string().max(500).nullable().optional(),
  /** Compat. nombre JSON: datos org. vienen del SAP staging, no de Oracle. */
  oracle_user: sapOrgUserSchema.nullable().optional(),
  glpi_registration_number: z.string().max(64).nullable().optional(),
  glpi_firstname: z.string().max(160).nullable().optional(),
  glpi_realname: z.string().max(160).nullable().optional(),
  technician_name: z.string().max(200).nullable().optional(),
  technician_signature_png_base64: z.string().max(8_000_000).nullable().optional(),
  additional_signer: additionalSignerSchema.nullable().optional(),
  signature_png_base64: z.string().max(8_000_000).optional().default(''),
  assets: z.array(actaAssetSchema).min(1).max(200),
  photos: z.array(actaPhotoSchema).max(20).optional().default([]),
});

export type ActaBienesBody = z.infer<typeof actaBienesBodySchema>;

export const actaBienesEmailBodySchema = actaBienesBodySchema.extend({
  to: z.string().email().max(320),
});

export type ActaBienesEmailBody = z.infer<typeof actaBienesEmailBodySchema>;
