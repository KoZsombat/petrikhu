CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "documents_search_trgm_idx" ON "documents" USING gin ("search_text" gin_trgm_ops);