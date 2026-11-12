ALTER TABLE "posts" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "reviewNote" text;--> statement-breakpoint
UPDATE "posts" SET "status" = 'published' WHERE "published" = true;
