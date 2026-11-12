CREATE TABLE "document_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"categoryId" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"file" text,
	"protected" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "contentHtml" text;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_categoryId_document_categories_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."document_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_categories_slug_idx" ON "document_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_category_slug_idx" ON "documents" USING btree ("categoryId","slug");