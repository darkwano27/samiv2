/** Respuesta de `GET /api/admin/workers/directory`. */
export type WorkerDirectoryRow = {
  sap_code: string;
  nombre: string;
  apellido: string;
  /**
   * `ad` = correo corporativo en SAP. `local` = sin AD; el flujo es local (ver `status` para saber si ya se dio de alta).
   */
  access: 'ad' | 'local';
  status: 'activo' | 'pendiente';
  /** Cuenta local bloqueada por intentos fallidos de contraseña. */
  local_account_locked: boolean;
};

export type WorkersDirectoryResponse = {
  workers: WorkerDirectoryRow[];
};
