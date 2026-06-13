CREATE TYPE "public"."review_thread_comment_kind" AS ENUM('message', 'fix-proposal', 'system');--> statement-breakpoint
CREATE TYPE "public"."review_thread_fix_state" AS ENUM('proposed', 'pushed', 'discarded');--> statement-breakpoint
ALTER TABLE "review_thread_comments" ADD COLUMN "comment_kind" "review_thread_comment_kind" DEFAULT 'message' NOT NULL;--> statement-breakpoint
ALTER TABLE "review_thread_comments" ADD COLUMN "fix_state" "review_thread_fix_state";--> statement-breakpoint
ALTER TABLE "review_thread_comments" ADD COLUMN "commit_sha" varchar(64);