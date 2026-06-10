ALTER TABLE "pull_request_snapshots" ADD COLUMN "draft" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pull_request_snapshots" ADD COLUMN "merged_at" timestamp with time zone;