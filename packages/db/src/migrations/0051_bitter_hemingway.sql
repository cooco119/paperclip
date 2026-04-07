CREATE TABLE "skill_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"match_source_type" text,
	"match_source_pattern" text,
	"match_trust_level" text,
	"match_agent_roles" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"requested_by_agent_id" uuid NOT NULL,
	"skill_source" text NOT NULL,
	"skill_name" text NOT NULL,
	"skill_description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_id" uuid,
	"resolved_skill_id" uuid,
	"decision_note" text,
	"decided_by_agent_id" uuid,
	"decided_by_user_id" text,
	"decided_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skill_policies" ADD CONSTRAINT "skill_policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_requests" ADD CONSTRAINT "skill_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_requests" ADD CONSTRAINT "skill_requests_requested_by_agent_id_agents_id_fk" FOREIGN KEY ("requested_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_requests" ADD CONSTRAINT "skill_requests_resolved_skill_id_company_skills_id_fk" FOREIGN KEY ("resolved_skill_id") REFERENCES "public"."company_skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_requests" ADD CONSTRAINT "skill_requests_decided_by_agent_id_agents_id_fk" FOREIGN KEY ("decided_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skill_policies_company_idx" ON "skill_policies" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "skill_requests_company_status_idx" ON "skill_requests" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "skill_requests_agent_idx" ON "skill_requests" USING btree ("requested_by_agent_id");