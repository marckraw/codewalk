CREATE TYPE "public"."review_thread_agent_state" AS ENUM('pending', 'streaming', 'complete', 'error');--> statement-breakpoint
CREATE TYPE "public"."review_thread_comment_author_type" AS ENUM('user', 'agent');--> statement-breakpoint
CREATE TYPE "public"."review_thread_diff_side" AS ENUM('old', 'new');--> statement-breakpoint
CREATE TYPE "public"."review_thread_status" AS ENUM('open', 'resolved', 'outdated');--> statement-breakpoint
CREATE TABLE "review_thread_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_type" "review_thread_comment_author_type" NOT NULL,
	"author_user_id" uuid,
	"body" text NOT NULL,
	"agent_state" "review_thread_agent_state",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" varchar(191) NOT NULL,
	"repo" varchar(191) NOT NULL,
	"pull_request_number" integer NOT NULL,
	"anchor_snapshot_id" uuid,
	"anchor_commit_sha" varchar(64) NOT NULL,
	"file_path" text NOT NULL,
	"side" "review_thread_diff_side" DEFAULT 'new' NOT NULL,
	"line_start" integer NOT NULL,
	"line_end" integer NOT NULL,
	"excerpt" text NOT NULL,
	"status" "review_thread_status" DEFAULT 'open' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_thread_comments" ADD CONSTRAINT "review_thread_comments_thread_id_review_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."review_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_thread_comments" ADD CONSTRAINT "review_thread_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_threads" ADD CONSTRAINT "review_threads_anchor_snapshot_id_pull_request_snapshots_id_fk" FOREIGN KEY ("anchor_snapshot_id") REFERENCES "public"."pull_request_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_threads" ADD CONSTRAINT "review_threads_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_thread_comments_thread_idx" ON "review_thread_comments" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "review_threads_pull_request_idx" ON "review_threads" USING btree ("owner","repo","pull_request_number");--> statement-breakpoint
CREATE INDEX "review_threads_status_idx" ON "review_threads" USING btree ("status");