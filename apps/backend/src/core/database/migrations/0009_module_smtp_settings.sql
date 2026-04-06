CREATE TABLE IF NOT EXISTS "module_smtp_settings" (
	"module_slug" varchar(100) PRIMARY KEY NOT NULL,
	"smtp_host" varchar(255) NOT NULL,
	"smtp_port" integer DEFAULT 587 NOT NULL,
	"mail_secure" boolean DEFAULT false NOT NULL,
	"smtp_user" varchar(320),
	"smtp_from" varchar(320) NOT NULL,
	"smtp_pass_encrypted" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
