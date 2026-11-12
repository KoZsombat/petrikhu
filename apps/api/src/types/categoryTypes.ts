import { z } from "zod";

export const postCategoryInputSchema = z.object({
  title: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sortOrder: z.number().int().min(0).default(0),
});

export const postCategoryUpdateSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type PostCategoryInput = z.infer<typeof postCategoryInputSchema>;
export type PostCategoryUpdate = z.infer<typeof postCategoryUpdateSchema>;
