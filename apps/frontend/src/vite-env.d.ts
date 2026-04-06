/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `'false'` desactiva filtros RBAC en el cliente; omitir = activo. */
  readonly VITE_RBAC_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
