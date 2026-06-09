ALTER TABLE "code_review_guide_generations" ADD COLUMN "github_comment_id" varchar(191);--> statement-breakpoint
ALTER TABLE "code_review_guide_generations" ADD COLUMN "github_comment_url" text;