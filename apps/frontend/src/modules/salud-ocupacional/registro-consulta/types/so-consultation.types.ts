/** Respuesta SAP para búsqueda de paciente (backend camelCase). */
export type SoSapWorker = {
  cod: string;
  name: string;
  /** Sede (SAP `sede`). */
  sede: string | null;
  /** Cargo / puesto (SAP `stext`). */
  jobTitle: string | null;
  /** Compat.: cargo o fallback; usar con `sede`. */
  position: string | null;
  division: string | null;
  subdivision: string | null;
  age: number | null;
  emailCorp: string | null;
  emailPersonal: string | null;
  isActive: boolean;
};

export type SoDiagnosis = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

export type SoMedicine = {
  id: string;
  name: string;
  presentation: string;
  concentration: string;
  administrationRoute: string;
  inventoryUnit: string;
  isActive: boolean;
};

export type SoDischargeCondition = 'observacion' | 'recuperado' | 'derivado';

export type SoPrescriptionDraft = {
  localKey: string;
  medicineId: string;
  /** Descripción / artículo */
  medicineLabel: string;
  concentration: string;
  presentation: string;
  administrationRoute: string;
  quantity: number;
  frequency?: string;
  duration?: string;
  instructions?: string;
};

export type CreateConsultationPayload = {
  patientCod: string;
  patientName: string;
  patientPosition?: string;
  patientDivision?: string;
  patientSubdivision?: string;
  patientAge?: number;
  patientEmail?: string;
  referredByCod?: string;
  referredByName?: string;
  attentionDate: string;
  reason: string;
  dischargeCondition: SoDischargeCondition;
  receiptNumber?: string;
  emailTo?: string;
  emailCc?: string[];
  signatureData?: string;
  diagnosisIds: string[];
  prescriptions: {
    medicineId: string;
    frequency?: string;
    duration?: string;
    quantity: number;
    instructions?: string;
  }[];
};
