CREATE TABLE "so_consultation_diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"diagnosis_id" uuid NOT NULL,
	CONSTRAINT "uq_so_consultation_diagnosis_pair" UNIQUE("consultation_id","diagnosis_id")
);
--> statement-breakpoint
CREATE TABLE "so_consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_cod" varchar(20) NOT NULL,
	"patient_name" varchar(200) NOT NULL,
	"patient_position" varchar(200),
	"patient_division" varchar(200),
	"patient_subdivision" varchar(200),
	"patient_age" integer,
	"patient_email" varchar(200),
	"referred_by_cod" varchar(20),
	"referred_by_name" varchar(200),
	"attention_date" timestamp with time zone NOT NULL,
	"reason" text,
	"discharge_condition" varchar(20) NOT NULL,
	"receipt_number" varchar(50),
	"email_to" varchar(200),
	"email_cc" jsonb,
	"signature_data" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "so_consultations_patient_age_check" CHECK ("so_consultations"."patient_age" IS NULL OR ("so_consultations"."patient_age" >= 0 AND "so_consultations"."patient_age" <= 120)),
	CONSTRAINT "so_consultations_discharge_check" CHECK ("so_consultations"."discharge_condition" IN ('observacion','recuperado','derivado'))
);
--> statement-breakpoint
CREATE TABLE "so_diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "so_diagnoses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "so_medicines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"presentation" varchar(100) NOT NULL,
	"concentration" varchar(100) NOT NULL,
	"administration_route" varchar(100) NOT NULL,
	"inventory_unit" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "so_prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"medicine_id" uuid NOT NULL,
	"medicine_name" varchar(200) NOT NULL,
	"presentation" varchar(100) NOT NULL,
	"concentration" varchar(100) NOT NULL,
	"administration_route" varchar(100) NOT NULL,
	"frequency" varchar(100),
	"duration" varchar(100),
	"quantity" integer NOT NULL,
	"instructions" text,
	CONSTRAINT "so_prescriptions_quantity_check" CHECK ("so_prescriptions"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "so_consultation_diagnoses" ADD CONSTRAINT "so_consultation_diagnoses_consultation_id_so_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."so_consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "so_consultation_diagnoses" ADD CONSTRAINT "so_consultation_diagnoses_diagnosis_id_so_diagnoses_id_fk" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."so_diagnoses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "so_consultations" ADD CONSTRAINT "so_consultations_created_by_workers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."workers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "so_prescriptions" ADD CONSTRAINT "so_prescriptions_consultation_id_so_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."so_consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "so_prescriptions" ADD CONSTRAINT "so_prescriptions_medicine_id_so_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."so_medicines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_so_consultation_diagnoses_consultation" ON "so_consultation_diagnoses" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_so_consultations_patient_cod" ON "so_consultations" USING btree ("patient_cod");--> statement-breakpoint
CREATE INDEX "idx_so_consultations_created_by" ON "so_consultations" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_so_consultations_attention_date" ON "so_consultations" USING btree ("attention_date");--> statement-breakpoint
CREATE INDEX "idx_so_medicines_name" ON "so_medicines" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_so_prescriptions_consultation_id" ON "so_prescriptions" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_so_prescriptions_medicine_id" ON "so_prescriptions" USING btree ("medicine_id");