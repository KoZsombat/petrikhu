-- Media bytes are stored uncompressed and out of line, so serving a byte range reads only that slice
-- (substring on a STORAGE EXTERNAL bytea does not decompress the whole value). Images and PDFs are compressed anyway.
ALTER TABLE "media" ALTER COLUMN "data" SET STORAGE EXTERNAL;--> statement-breakpoint
ALTER TABLE "media_variants" ALTER COLUMN "data" SET STORAGE EXTERNAL;
