import { z } from 'zod';

/** Query común a todos los endpoints de reportes SO. */
export const soReportFiltersQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  /** Código o fragmento de división SAP (ej. AR10). Opcional = todas. */
  division: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(1).max(40).optional(),
  ),
  /** Texto snapshot SAP de subdivisión (valor del desplegable). Opcional = todas. */
  subdivision: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(1).max(200).optional(),
  ),
});

export type SoReportFiltersQuery = z.infer<typeof soReportFiltersQuerySchema>;

export const soReportTopQuerySchema = soReportFiltersQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(10).optional().default(5),
});

export const soReportTrendQuerySchema = soReportFiltersQuerySchema.extend({
  months: z.coerce.number().int().min(3).max(24).optional().default(12),
});
