CREATE TABLE "local_auth" (
	"sap_code" varchar(20) PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"is_temp_password" boolean DEFAULT false NOT NULL,
	"temp_token" uuid,
	"temp_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
