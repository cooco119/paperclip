CREATE TABLE "delegation_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"scope" text DEFAULT 'all' NOT NULL,
	"level" integer NOT NULL,
	"decided_by_user_id" text,
	"decided_by_agent_id" uuid,
	"session_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delegation_poker_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"scope" text DEFAULT 'all' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"proposed_level" integer,
	"final_level" integer,
	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"initiated_by_user_id" text,
	"initiated_by_agent_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delegation_poker_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"voter_user_id" text,
	"voter_agent_id" uuid,
	"level" integer NOT NULL,
	"rationale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delegation_agreements" ADD CONSTRAINT "delegation_agreements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "delegation_agreements" ADD CONSTRAINT "delegation_agreements_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "delegation_agreements" ADD CONSTRAINT "delegation_agreements_decided_by_agent_id_agents_id_fk" FOREIGN KEY ("decided_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "delegation_poker_sessions" ADD CONSTRAINT "delegation_poker_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "delegation_poker_sessions" ADD CONSTRAINT "delegation_poker_sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "delegation_poker_sessions" ADD CONSTRAINT "delegation_poker_sessions_initiated_by_agent_id_agents_id_fk" FOREIGN KEY ("initiated_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "delegation_poker_votes" ADD CONSTRAINT "delegation_poker_votes_session_id_delegation_poker_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."delegation_poker_sessions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "delegation_poker_votes" ADD CONSTRAINT "delegation_poker_votes_voter_agent_id_agents_id_fk" FOREIGN KEY ("voter_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "delegation_agreements_company_agent_scope_idx" ON "delegation_agreements" USING btree ("company_id","agent_id","scope");
--> statement-breakpoint
CREATE INDEX "delegation_agreements_agent_idx" ON "delegation_agreements" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX "delegation_poker_sessions_company_status_idx" ON "delegation_poker_sessions" USING btree ("company_id","status");
--> statement-breakpoint
CREATE INDEX "delegation_poker_sessions_agent_idx" ON "delegation_poker_sessions" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX "delegation_poker_votes_session_idx" ON "delegation_poker_votes" USING btree ("session_id");
