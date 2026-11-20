import { z } from "zod";

/**
 * `status` is not writable through the generic input schemas: it only moves through
 * `/submit` (draft|revision -> pending) and `/review` (pending -> published|revision).
 * `published` is derived from `status` server-side and is not client-writable either.
 */
export const postStatusSchema = z.enum([
  "draft",
  "pending",
  "revision",
  "published",
]);

export const postInputSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
  excerpt: z.string().max(500).default(""),
  content: z.string().min(1),
  contentHtml: z.string().nullable().default(null),
  category: z.string().trim().min(1).max(100).default("Hírek"),
  image: z.string().max(500).nullable().default(null),
  gallery: z.array(z.string().max(500)).max(24).default([]),
});

export const postUpdateSchema = postInputSchema.partial();

export const postListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
  category: z.string().trim().max(100).optional(),
  q: z.string().trim().max(200).optional(),
});

export const adminPostListQuerySchema = z.object({
  status: postStatusSchema.optional(),
});

/** A rejection is only useful to the author if it says what to fix. */
export const postReviewSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "reject" && !value.note) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Rejection requires a note",
      });
    }
  });

export type PostInput = z.infer<typeof postInputSchema>;
export type PostUpdate = z.infer<typeof postUpdateSchema>;
export type PostListQuery = z.infer<typeof postListQuerySchema>;
export type AdminPostListQuery = z.infer<typeof adminPostListQuerySchema>;
export type PostReview = z.infer<typeof postReviewSchema>;
export type PostStatus = z.infer<typeof postStatusSchema>;
