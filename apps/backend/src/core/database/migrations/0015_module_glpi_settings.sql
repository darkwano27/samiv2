CREATE TABLE IF NOT EXISTS "module_glpi_settings" (
	"module_slug" varchar(100) PRIMARY KEY NOT NULL,
	"glpi_db_host" varchar(255) NOT NULL,
	"glpi_db_port" integer DEFAULT 3306 NOT NULL,
	"glpi_db_user" varchar(160) NOT NULL,
	"glpi_db_name" varchar(128) NOT NULL,
	"glpi_db_pass_encrypted" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
