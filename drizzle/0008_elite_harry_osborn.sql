CREATE TYPE "public"."review_agent_session_status" AS ENUM('idle', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "review_agent_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" varchar(191) NOT NULL,
	"repo" varchar(191) NOT NULL,
	"pull_request_number" integer NOT NULL,
	"snapshot_id" uuid,
	"daemon_session_id" varchar(191) NOT NULL,
	"provider" "code_review_guide_provider" NOT NULL,
	"model" text NOT NULL,
	"effort" text,
	"status" "review_agent_session_status" DEFAULT 'idle' NOT NULL,
	"continuation_token" text,
	"last_seq" integer DEFAULT 0 NOT NULL,
	"workspace_repository" text,
	"workspace_branch_name" text,
	"workspace_base_ref" text,
	"pr_url" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_agent_sessions" ADD CONSTRAINT "review_agent_sessions_snapshot_id_pull_request_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."pull_request_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_agent_sessions" ADD CONSTRAINT "review_agent_sessions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "review_agent_sessions_daemon_session_idx" ON "review_agent_sessions" USING btree ("daemon_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_agent_sessions_pull_request_idx" ON "review_agent_sessions" USING btree ("owner","repo","pull_request_number");