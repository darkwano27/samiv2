/** `GET /api/admin/rbac/modules-summary`. */
export type ModuleAdminRow = {
  sap_code: string;
  name: string;
  scope: string;
  assignment_id: string;
};

export type ModuleRoleSummaryRow = {
  role_slug: string;
  role_label: string;
  worker_count: number;
};

export type ModuleSummaryItem = {
  module_slug: string;
  module_label: string;
  app_count: number;
  admins: ModuleAdminRow[];
  role_summary: ModuleRoleSummaryRow[];
  total_workers_with_roles: number;
};

export type ModulesSummaryResponse = {
  modules: ModuleSummaryItem[];
};
