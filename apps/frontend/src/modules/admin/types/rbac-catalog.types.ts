/** Respuesta de `GET /api/admin/rbac/catalog`. */
export type RbacCatalogAppDto = {
  id: string;
  slug: string;
  module_slug: string;
  label: string;
  is_management: boolean;
};

export type RbacCatalogRoleDto = {
  id: string;
  app_id: string;
  slug: string;
  label: string;
  level: number;
};

export type RbacCatalogResponse = {
  apps: RbacCatalogAppDto[];
  roles: RbacCatalogRoleDto[];
  features: {
    id: string;
    app_id: string;
    slug: string;
    label: string;
  }[];
};
