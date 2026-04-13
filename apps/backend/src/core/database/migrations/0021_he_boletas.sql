CREATE TABLE "he_boleta_headers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" text NOT NULL,
	"group_slug" varchar(64) NOT NULL,
	"division_code" varchar(24) NOT NULL,
	"subdivision_pairs" jsonb NOT NULL,
	"valid_from" varchar(10) NOT NULL,
	"valid_to" varchar(10) NOT NULL,
	"time_start" varchar(8) NOT NULL,
	"time_end" varchar(8) NOT NULL,
	"motivo_code" varchar(16) NOT NULL,
	"status" varchar(24) DEFAULT 'registrada' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "he_boleta_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"header_id" uuid NOT NULL,
	"pernr" varchar(20) NOT NULL,
	"worker_name" varchar(200),
	"valid_from" varchar(10) NOT NULL,
	"valid_to" varchar(10) NOT NULL,
	"days" integer NOT NULL,
	"time_start" varchar(8) NOT NULL,
	"time_end" varchar(8) NOT NULL,
	"motivo_code" varchar(16) NOT NULL,
	"observaciones" text
);
--> statement-breakpoint
ALTER TABLE "he_boleta_headers" ADD CONSTRAINT "he_boleta_headers_created_by_workers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."workers"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "he_boleta_lines" ADD CONSTRAINT "he_boleta_lines_header_id_he_boleta_headers_id_fk" FOREIGN KEY ("header_id") REFERENCES "public"."he_boleta_headers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_he_boleta_headers_created_by" ON "he_boleta_headers" USING btree ("created_by");
--> statement-breakpoint
CREATE INDEX "idx_he_boleta_headers_created_at" ON "he_boleta_headers" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "idx_he_boleta_lines_header" ON "he_boleta_lines" USING btree ("header_id");
