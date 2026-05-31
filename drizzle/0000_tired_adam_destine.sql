CREATE TYPE "public"."guide_risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."note_anchor_type" AS ENUM('guide_section', 'file', 'diff_range');--> statement-breakpoint
CREATE TYPE "public"."pull_request_file_status" AS ENUM('added', 'modified', 'removed', 'renamed', 'changed');--> statement-breakpoint
CREATE TYPE "public"."review_progress_target_type" AS ENUM('guide_section', 'file');--> statement-breakpoint
CREATE TABLE "guide_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guide_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text NOT NULL,
	"risk_level" "guide_risk_level" NOT NULL,
	"file_paths" jsonb NOT NULL,
	"checklist" jsonb NOT NULL,
	"key_hunks" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"model" varchar(191) NOT NULL,
	"overview" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pull_request_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"github_id" varchar(191) NOT NULL,
	"type" varchar(64) NOT NULL,
	"author_login" varchar(191),
	"body" text NOT NULL,
	"path" text,
	"line" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pull_request_commits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"sha" varchar(64) NOT NULL,
	"message" text NOT NULL,
	"author_name" varchar(191),
	"author_email" varchar(320),
	"authored_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pull_request_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"path" text NOT NULL,
	"previous_path" text,
	"status" "pull_request_file_status" NOT NULL,
	"additions" integer DEFAULT 0 NOT NULL,
	"deletions" integer DEFAULT 0 NOT NULL,
	"changes" integer DEFAULT 0 NOT NULL,
	"patch" text,
	"blob_sha" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pull_request_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" varchar(191) NOT NULL,
	"repo" varchar(191) NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"state" varchar(32) NOT NULL,
	"url" text NOT NULL,
	"base_ref" varchar(255) NOT NULL,
	"base_sha" varchar(64) NOT NULL,
	"head_ref" varchar(255) NOT NULL,
	"head_sha" varchar(64) NOT NULL,
	"author_login" varchar(191),
	"imported_by_user_id" uuid,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"guide_section_id" uuid,
	"anchor_type" "note_anchor_type" NOT NULL,
	"file_path" text,
	"line_start" integer,
	"line_end" integer,
	"body" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" "review_progress_target_type" NOT NULL,
	"target_id" varchar(512) NOT NULL,
	"reviewed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" varchar(191) NOT NULL,
	"email" varchar(320),
	"name" varchar(191),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guide_sections" ADD CONSTRAINT "guide_sections_guide_id_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guides" ADD CONSTRAINT "guides_snapshot_id_pull_request_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."pull_request_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_request_comments" ADD CONSTRAINT "pull_request_comments_snapshot_id_pull_request_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."pull_request_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_request_commits" ADD CONSTRAINT "pull_request_commits_snapshot_id_pull_request_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."pull_request_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_request_files" ADD CONSTRAINT "pull_request_files_snapshot_id_pull_request_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."pull_request_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_request_snapshots" ADD CONSTRAINT "pull_request_snapshots_imported_by_user_id_users_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_notes" ADD CONSTRAINT "review_notes_snapshot_id_pull_request_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."pull_request_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_notes" ADD CONSTRAINT "review_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_notes" ADD CONSTRAINT "review_notes_guide_section_id_guide_sections_id_fk" FOREIGN KEY ("guide_section_id") REFERENCES "public"."guide_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_progress" ADD CONSTRAINT "review_progress_snapshot_id_pull_request_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."pull_request_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_progress" ADD CONSTRAINT "review_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guide_sections_guide_order_idx" ON "guide_sections" USING btree ("guide_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "guides_snapshot_idx" ON "guides" USING btree ("snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pull_request_comments_snapshot_github_id_idx" ON "pull_request_comments" USING btree ("snapshot_id","github_id");--> statement-breakpoint
CREATE INDEX "pull_request_comments_snapshot_idx" ON "pull_request_comments" USING btree ("snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pull_request_commits_snapshot_sha_idx" ON "pull_request_commits" USING btree ("snapshot_id","sha");--> statement-breakpoint
CREATE UNIQUE INDEX "pull_request_files_snapshot_path_idx" ON "pull_request_files" USING btree ("snapshot_id","path");--> statement-breakpoint
CREATE INDEX "pull_request_files_snapshot_idx" ON "pull_request_files" USING btree ("snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pull_request_snapshots_github_pr_idx" ON "pull_request_snapshots" USING btree ("owner","repo","number","head_sha");--> statement-breakpoint
CREATE INDEX "pull_request_snapshots_imported_by_idx" ON "pull_request_snapshots" USING btree ("imported_by_user_id");--> statement-breakpoint
CREATE INDEX "review_notes_snapshot_user_idx" ON "review_notes" USING btree ("snapshot_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_progress_target_idx" ON "review_progress" USING btree ("snapshot_id","user_id","target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_idx" ON "users" USING btree ("clerk_user_id");