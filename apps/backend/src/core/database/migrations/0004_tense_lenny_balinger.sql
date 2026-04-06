ALTER TABLE "local_auth" ADD COLUMN "failed_login_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "local_auth" ADD COLUMN "locked_until" timestamp with time zone;