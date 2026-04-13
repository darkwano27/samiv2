ALTER TABLE "he_boleta_headers" ADD COLUMN "approved_by" text;
ALTER TABLE "he_boleta_headers" ADD COLUMN "approved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "he_boleta_headers" ADD CONSTRAINT "he_boleta_headers_approved_by_workers_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."workers"("id") ON DELETE set null ON UPDATE no action;
