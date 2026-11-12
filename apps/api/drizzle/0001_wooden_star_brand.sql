CREATE TABLE "teachers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"email" text,
	"room" text,
	"photo" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "category" text DEFAULT 'Hírek' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "image" text;--> statement-breakpoint
CREATE UNIQUE INDEX "teachers_name_idx" ON "teachers" USING btree ("name");