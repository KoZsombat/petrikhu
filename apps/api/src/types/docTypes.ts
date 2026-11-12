import { z } from "zod";

export const documentInputSchema = z.object({
  categoryId: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(300),
  file: z.string().max(1000).nullable().default(null),
  protected: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

export const documentUpdateSchema = documentInputSchema.partial();

export const categoryInputSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(300),
  sortOrder: z.number().int().min(0).default(0),
});

export const categoryUpdateSchema = categoryInputSchema.partial();

export type DocumentInput = z.infer<typeof documentInputSchema>;
export type DocumentUpdate = z.infer<typeof documentUpdateSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>;
