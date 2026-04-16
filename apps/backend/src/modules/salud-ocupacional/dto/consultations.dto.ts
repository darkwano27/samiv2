import { z } from 'zod';

export const DISCHARGE_CONDITIONS = [
  'observacion',
  'recuperado',
  'derivado',
] as const;

const PRESENTATIONS = [
  'Tableta',
  'Cápsula',
  'Ampolla',
  'Frasco',
  'Jarabe',
  'Crema',
  'Gel',
  'Gotas',
  'Supositorio',
  'Parche',
  'Inhalador',
  'Solución',
  'Suspensión',
  'Polvo',
  /** Catálogo inventario SO (insumos, sobres, etc.). */
  'Material',
  'Sobre',
  'Aerosol',
] as const;

const ADMIN_ROUTES = [
  'Oral (VO)',
  'Intramuscular (IM)',
  'Intravenosa (IV)',
  'Subcutánea (SC)',
  'Tópica',
  'Sublingual',
  'Rectal',
  'Inhalatoria',
  'Oftálmica',
  'Ótica',
  'Nasal',
  /** Insumos / material sin vía farmacológica. */
  'No aplica',
] as const;

const INVENTORY_UNITS = [
  'tableta',
  'cápsula',
  'ampolla',
  'frasco',
  'sobre',
  'tubo',
  'unidad',
] as const;

export const createDiagnosisBodySchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(20).optional(),
});

const isoDateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createMedicineBodySchema = z.object({
  name: z.string().min(1).max(200),
  presentation: z.enum(PRESENTATIONS),
  concentration: z.string().min(1).max(100),
  administrationRoute: z.enum(ADMIN_ROUTES),
  inventoryUnit: z.enum(INVENTORY_UNITS),
  expirationDate: isoDateOnly.optional(),
});

const prescriptionItemSchema = z.object({
  medicineId: z.string().uuid(),
  frequency: z.string().max(100).optional(),
  duration: z.string().max(100).optional(),
  quantity: z.number().int().min(0),
  instructions: z.string().optional(),
});

export const createConsultationBodySchema = z.object({
  patientCod: z.string().min(1).max(20),
  patientName: z.string().min(1).max(200),
  patientPosition: z.string().max(200).optional(),
  patientDivision: z.string().max(200).optional(),
  patientSubdivision: z.string().max(200).optional(),
  patientAge: z.number().int().min(0).max(120).optional(),
  patientEmail: z.string().email().optional(),
  referredByCod: z.string().max(20).optional(),
  referredByName: z.string().max(200).optional(),
  attentionDate: z.string().datetime(),
  reason: z.string().min(1).max(10_000),
  dischargeCondition: z.enum(DISCHARGE_CONDITIONS),
  receiptNumber: z.string().max(50).optional(),
  emailTo: z.string().email().optional(),
  /** Correo del responsable / jefatura (opcional). Dispara segundo correo sin PDF, con copia al paciente. */
  supervisorEmail: z.string().email().optional(),
  supervisorName: z.string().max(200).optional(),
  signatureData: z.string().optional(),
  diagnosisIds: z.array(z.string().uuid()).min(1),
  prescriptions: z.array(prescriptionItemSchema).optional().default([]),
});

export type CreateDiagnosisBody = z.infer<typeof createDiagnosisBodySchema>;
export type CreateMedicineBody = z.infer<typeof createMedicineBodySchema>;
export type CreateConsultationBody = z.infer<typeof createConsultationBodySchema>;

export const historialQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  division: z.string().max(200).optional(),
  subdivision: z.string().max(200).optional(),
  /** `workers.id` (= SAP quien registró la consulta). */
  attendedBy: z.string().max(32).optional(),
  /** ISO 8601 recomendado; se parsea con `new Date()`. */
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type HistorialQuery = z.infer<typeof historialQuerySchema>;

export const myConsultationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  /** Filtro por `attention_date` (inicio del día en fecha `YYYY-MM-DD`). */
  dateFrom: z.string().optional(),
  /** Filtro por `attention_date` (fin del día en fecha `YYYY-MM-DD`). */
  dateTo: z.string().optional(),
});

export type MyConsultationsQuery = z.infer<typeof myConsultationsQuerySchema>;

export const updateDiagnosisBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    code: z.string().max(20).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (o) =>
      o.name !== undefined || o.code !== undefined || o.isActive !== undefined,
    { message: 'Se requiere al menos un campo' },
  );

export const updateMedicineBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    presentation: z.enum(PRESENTATIONS).optional(),
    concentration: z.string().min(1).max(100).optional(),
    administrationRoute: z.enum(ADMIN_ROUTES).optional(),
    inventoryUnit: z.enum(INVENTORY_UNITS).optional(),
    expirationDate: z.union([isoDateOnly, z.null()]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (o) =>
      o.name !== undefined ||
      o.presentation !== undefined ||
      o.concentration !== undefined ||
      o.administrationRoute !== undefined ||
      o.inventoryUnit !== undefined ||
      o.expirationDate !== undefined ||
      o.isActive !== undefined,
    { message: 'Se requiere al menos un campo' },
  );

export type UpdateDiagnosisBody = z.infer<typeof updateDiagnosisBodySchema>;
export type UpdateMedicineBody = z.infer<typeof updateMedicineBodySchema>;
