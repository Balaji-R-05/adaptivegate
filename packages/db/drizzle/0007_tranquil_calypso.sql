CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"identity_id" uuid,
	"tool" text NOT NULL,
	"server_id" uuid NOT NULL,
	"arguments_redacted" jsonb,
	"rule_name" text NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"server_scope" jsonb,
	"budget_limit" integer,
	"policy_id" uuid,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identities_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "identity_id" uuid;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Row-level security as a second layer behind application checks, same
-- pattern as every other user-owned table (see 0003_auth_sync_and_rls.sql).
ALTER TABLE "public"."identities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."approvals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "users can view own identities" ON "public"."identities"
  FOR SELECT USING (auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "users can view own approvals" ON "public"."approvals"
  FOR SELECT USING (auth.uid() = user_id);