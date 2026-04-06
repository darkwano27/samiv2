CREATE TABLE "workforce_boleta_export_settings" (
	"module_slug" varchar(100) PRIMARY KEY NOT NULL,
	"protocol" varchar(16) DEFAULT 'sftp' NOT NULL,
	"host" varchar(255) DEFAULT '' NOT NULL,
	"port" integer DEFAULT 22 NOT NULL,
	"remote_path" text DEFAULT '/' NOT NULL,
	"share_name" varchar(512),
	"username" varchar(320),
	"password_encrypted" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
