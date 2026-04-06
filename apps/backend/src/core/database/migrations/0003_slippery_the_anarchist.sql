CREATE TABLE "app_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"slug" varchar(100) NOT NULL,
	"label" varchar(200) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"module_slug" varchar(100) NOT NULL,
	"label" varchar(200) NOT NULL,
	"description" text,
	"is_management" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apps_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "default_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_profile_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_profile_items" (
	"profile_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "module_profile_items_profile_id_app_id_feature_id_role_id_pk" PRIMARY KEY("profile_id","app_id","feature_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "module_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_slug" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"label" varchar(200) NOT NULL,
	"description" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_feature_id_pk" PRIMARY KEY("role_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"slug" varchar(100) NOT NULL,
	"label" varchar(200) NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"description" text,
	"applicable_apps" uuid[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_level_check" CHECK (("roles"."level" >= 0 AND "roles"."level" <= 100))
);
--> statement-breakpoint
CREATE TABLE "worker_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" text NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by" text,
	"applied_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "app_features" ADD CONSTRAINT "app_features_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "default_role_assignments" ADD CONSTRAINT "default_role_assignments_module_profile_id_module_profiles_id_fk" FOREIGN KEY ("module_profile_id") REFERENCES "public"."module_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "default_role_assignments" ADD CONSTRAINT "default_role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_profile_items" ADD CONSTRAINT "module_profile_items_profile_id_module_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."module_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_profile_items" ADD CONSTRAINT "module_profile_items_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_profile_items" ADD CONSTRAINT "module_profile_items_feature_id_app_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."app_features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_profile_items" ADD CONSTRAINT "module_profile_items_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_profiles" ADD CONSTRAINT "module_profiles_created_by_workers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_feature_id_app_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."app_features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_role_assignments" ADD CONSTRAINT "worker_role_assignments_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_role_assignments" ADD CONSTRAINT "worker_role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_role_assignments" ADD CONSTRAINT "worker_role_assignments_assigned_by_workers_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_role_assignments" ADD CONSTRAINT "worker_role_assignments_applied_profile_id_module_profiles_id_fk" FOREIGN KEY ("applied_profile_id") REFERENCES "public"."module_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_features_app_id_slug_key" ON "app_features" USING btree ("app_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_apps_one_mgmt_per_module" ON "apps" USING btree ("module_slug") WHERE "apps"."is_management" = true;--> statement-breakpoint
CREATE INDEX "idx_default_role_assignments_profile" ON "default_role_assignments" USING btree ("module_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_app_id_slug_key" ON "roles" USING btree ("app_id","slug");--> statement-breakpoint
CREATE INDEX "idx_worker_role_assignments_worker" ON "worker_role_assignments" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "idx_worker_role_assignments_role" ON "worker_role_assignments" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_worker_role_manual_unique" ON "worker_role_assignments" USING btree ("worker_id","role_id") WHERE "worker_role_assignments"."applied_profile_id" IS NULL;