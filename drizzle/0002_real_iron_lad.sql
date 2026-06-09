CREATE TYPE "public"."code_review_guide_generation_status" AS ENUM('running', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "code_review_guide_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"guide_id" uuid,
	"provider" "code_review_guide_provider",
	"model" varchar(191),
	"effort" varchar(191),
	"force" boolean DEFAULT false NOT NULL,
	"status" "code_review_guide_generation_status" NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "code_review_guide_generations" ADD CONSTRAINT "code_review_guide_generations_snapshot_id_pull_request_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."pull_request_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_review_guide_generations" ADD CONSTRAINT "code_review_guide_generations_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_review_guide_generations" ADD CONSTRAINT "code_review_guide_generations_guide_id_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "public"."guides"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "code_review_guide_generations_snapshot_idx" ON "code_review_guide_generations" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "code_review_guide_generations_status_idx" ON "code_review_guide_generations" USING btree ("status","updated_at");