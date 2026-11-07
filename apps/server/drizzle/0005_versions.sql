ALTER TABLE "documents" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;