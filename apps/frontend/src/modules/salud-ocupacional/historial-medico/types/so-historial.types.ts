export type SoHistorialRow = {
  id: string;
  correlative: number;
  patientCod: string;
  patientName: string;
  patientPosition: string | null;
  patientDivision: string | null;
  patientSubdivision: string | null;
  patientEstabl: string | null;
  attentionDate: string;
  reason: string | null;
  dischargeCondition: string;
  createdAt: string;
  /** Quien registró la consulta (`workers.name` o SAP). */
  attendedByName: string;
};

export type SoConsultationDetailDx = {
  id: string;
  name: string;
  code: string | null;
};

export type SoConsultationDetailRx = {
  id: string;
  medicineName: string;
  presentation: string | null;
  concentration: string | null;
  administrationRoute: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number | null;
  instructions: string | null;
};

export type SoConsultationDetail = {
  id: string;
  correlative: number;
  patientCod: string;
  patientName: string;
  patientPosition: string | null;
  patientDivision: string | null;
  patientSubdivision: string | null;
  patientEstabl: string | null;
  patientDocumentId: string | null;
  patientBirthDate: string | null;
  patientCostCenter: string | null;
  patientHireDate: string | null;
  patientAge: number | null;
  patientEmail: string | null;
  referredByCod: string | null;
  referredByName: string | null;
  attentionDate: string;
  reason: string | null;
  dischargeCondition: string;
  receiptNumber: string | null;
  emailTo: string | null;
  createdBy: string;
  createdAt?: string;
  emailCc?: string[] | null;
  signatureData?: string | null;
  diagnoses: SoConsultationDetailDx[];
  prescriptions: SoConsultationDetailRx[];
};

export type SoHistorialResponse = {
  data: SoHistorialRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
