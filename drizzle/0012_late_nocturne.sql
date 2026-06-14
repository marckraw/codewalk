CREATE TYPE "public"."review_thread_kind" AS ENUM('inline', 'discussion');--> statement-breakpoint
ALTER TABLE "review_threads" ADD COLUMN "kind" "review_thread_kind" DEFAULT 'inline' NOT NULL;