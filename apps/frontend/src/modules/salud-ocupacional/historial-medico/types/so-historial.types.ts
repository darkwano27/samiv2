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
