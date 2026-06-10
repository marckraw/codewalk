CREATE TYPE "public"."repository_review_rule_type" AS ENUM('allow', 'block');--> statement-breakpoint
CREATE TABLE "repository_review_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" varchar(191) NOT NULL,
	"repo" varchar(191) NOT NULL,
	"rule" "repository_review_rule_type" NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "repository_review_rules" ADD CONSTRAINT "repository_review_rules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "repository_review_rules_repo_idx" ON "repository_review_rules" USING btree ("owner","repo");