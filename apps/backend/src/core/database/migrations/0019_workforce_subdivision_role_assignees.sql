CREATE TABLE "workforce_subdivision_role_assignees" (
	"division_code" varchar(24) NOT NULL,
	"subdivision_code" varchar(24) NOT NULL,
	"role" varchar(24) NOT NULL,
	"worker_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workforce_subdivision_role_assignees_division_code_subdivision_code_role_worker_id_pk" PRIMARY KEY("division_code","subdivision_code","role","worker_id")
);
--> statement-breakpoint
ALTER TABLE "workforce_subdivision_role_assignees" ADD CONSTRAINT "workforce_subdivision_role_assignees_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_workforce_sub_assign_div_sub" ON "workforce_subdivision_role_assignees" USING btree ("division_code","subdivision_code");
