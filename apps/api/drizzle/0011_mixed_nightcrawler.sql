CREATE TABLE "post_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"postId" text,
	"actorId" text,
	"action" text NOT NULL,
	"fromStatus" text,
	"toStatus" text,
	"note" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "authorId" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "reviewerId" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "submittedAt" timestamp;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "reviewedAt" timestamp;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "publishedAt" timestamp;--> statement-breakpoint
-- Existing posts predate author ownership: attribute them to the oldest account (the seeded admin).
UPDATE "posts"
SET "authorId" = (SELECT "id" FROM "user" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "authorId" IS NULL;--> statement-breakpoint
-- A published post's publication date is when it went live, not the import timestamp.
UPDATE "posts" SET "publishedAt" = "createdAt" WHERE "status" = 'published';--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "authorId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "post_audit_log" ADD CONSTRAINT "post_audit_log_postId_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_audit_log" ADD CONSTRAINT "post_audit_log_actorId_user_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_audit_log_post_idx" ON "post_audit_log" USING btree ("postId");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_reviewerId_user_id_fk" FOREIGN KEY ("reviewerId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_author_idx" ON "posts" USING btree ("authorId");--> statement-breakpoint
CREATE INDEX "posts_status_idx" ON "posts" USING btree ("status");