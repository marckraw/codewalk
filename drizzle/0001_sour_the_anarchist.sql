CREATE TYPE "public"."code_review_guide_generator" AS ENUM('deterministic', 'agent');--> statement-breakpoint
CREATE TYPE "public"."code_review_guide_mode" AS ENUM('pull-request');--> statement-breakpoint
CREATE TYPE "public"."code_review_guide_provider" AS ENUM('claude', 'codex', 'cursor', 'gemini');--> statement-breakpoint
CREATE TYPE "public"."code_review_guide_status" AS ENUM('ready', 'failed');--> statement-breakpoint
CREATE TABLE "guide_section_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guide_section_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"path" text NOT NULL,
	"status" varchar(64) NOT NULL,
	"reason" text NOT NULL,
	"hunk_hints" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DELETE FROM "guide_sections";--> statement-breakpoint
DELETE FROM "guides";--> statement-breakpoint
DROP INDEX "guides_snapshot_idx";--> statement-breakpoint
ALTER TABLE "guides" ALTER COLUMN "overview" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "guides" ALTER COLUMN "overview" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "guide_sections" ADD COLUMN "daemon_section_id" varchar(191) NOT NULL;--> statement-breakpoint
ALTER TABLE "guide_sections" ADD COLUMN "narrative" text NOT NULL;--> statement-breakpoint
ALTER TABLE "guide_sections" ADD COLUMN "risk_rationale" text NOT NULL;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "daemon_guide_id" varchar(191) NOT NULL;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "repository" text NOT NULL;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "pull_request_number" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "target_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "mode" "code_review_guide_mode" DEFAULT 'pull-request' NOT NULL;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "cache_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "cache_identity" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "provider" "code_review_guide_provider" NOT NULL;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "effort" varchar(191);--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "status" "code_review_guide_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "generated_by" "code_review_guide_generator" NOT NULL;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "pull_request" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "summary" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "guide_section_files" ADD CONSTRAINT "guide_section_files_guide_section_id_guide_sections_id_fk" FOREIGN KEY ("guide_section_id") REFERENCES "public"."guide_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guide_section_files_section_order_idx" ON "guide_section_files" USING btree ("guide_section_id","order");--> statement-breakpoint
CREATE INDEX "guide_section_files_section_path_idx" ON "guide_section_files" USING btree ("guide_section_id","path");--> statement-breakpoint
CREATE UNIQUE INDEX "guide_sections_guide_daemon_section_idx" ON "guide_sections" USING btree ("guide_id","daemon_section_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guides_daemon_guide_id_idx" ON "guides" USING btree ("daemon_guide_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guides_snapshot_mode_cache_idx" ON "guides" USING btree ("snapshot_id","mode","cache_key");--> statement-breakpoint
CREATE INDEX "guides_target_idx" ON "guides" USING btree ("target_id","mode","updated_at");--> statement-breakpoint
ALTER TABLE "guide_sections" DROP COLUMN "file_paths";--> statement-breakpoint
ALTER TABLE "guide_sections" DROP COLUMN "key_hunks";
