CREATE TABLE IF NOT EXISTS "module_sharepoint_settings" (
  "module_slug" varchar(100) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(128),
  "client_id" varchar(128),
  "client_secret_encrypted" text,
  "site_path" varchar(512),
  "drive_name" varchar(128),
  "parent_folder" varchar(512),
  "public_host" varchar(512),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
