import { z } from "zod";

export const postSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string(),
  content: z.string().optional(),
  contentHtml: z.string().nullable().optional(),
  category: z.string(),
  image: z.string().nullable(),
  gallery: z.array(z.string()).default([]),
  published: z.boolean(),
  status: z.enum(["draft", "pending", "published"]),
  reviewNote: z.string().nullable(),
  publishedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const postsSchema = z.array(postSchema);

export const postCategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  sortOrder: z.number(),
});
export const postCategoriesSchema = z.array(postCategorySchema);
export const postCategoryInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sortOrder: z.number().int().min(0),
});

export const postInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(200)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and dashes",
    ),
  excerpt: z.string().trim().max(500),
  content: z.string().trim().min(1, "Content is required"),
  contentHtml: z.string().nullable().optional(),
  category: z.string().trim().min(1).max(100),
  image: z.string().trim().max(1000).nullable(),
  gallery: z.array(z.string().trim().max(1000)).max(24).default([]),
});

export const teacherSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  email: z.string().nullable(),
  room: z.string().nullable(),
  photo: z.string().nullable(),
  sortOrder: z.number(),
  published: z.boolean(),
});

export const teachersSchema = z.array(teacherSchema);

export const teacherInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  role: z.string().trim().max(300),
  email: z.string().trim().max(200).nullable(),
  room: z.string().trim().max(200).nullable(),
  photo: z.string().trim().max(1000).nullable(),
  sortOrder: z.number().int().min(0),
  published: z.boolean(),
});

export const documentSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  slug: z.string(),
  title: z.string(),
  file: z.string().nullable(),
  protected: z.boolean(),
  sortOrder: z.number(),
});

export const documentsSchema = z.array(documentSchema);

export const categorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  sortOrder: z.number(),
  docs: z.array(documentSchema),
});

export const categoriesSchema = z.array(categorySchema);

export const documentInputSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1, "Title is required").max(300),
  file: z.string().trim().max(1000).nullable(),
  protected: z.boolean(),
  sortOrder: z.number().int().min(0),
});

export const categoryInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1, "Title is required").max(300),
  sortOrder: z.number().int().min(0),
});

export const mediaSchema = z.object({
  id: z.string(),
  name: z.string(),
  mime: z.string(),
  size: z.number(),
  url: z.string(),
  createdAt: z.string(),
});

export const mediaListSchema = z.array(mediaSchema);

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  permissions: z.array(z.string()),
  isSeededAdmin: z.boolean(),
  createdAt: z.string(),
});

export const permissionInfoSchema = z.object({
  key: z.string(),
  label: z.string(),
  group: z.string(),
});

export const permissionCatalogSchema = z.object({
  permissions: z.array(permissionInfoSchema),
});

export const myPermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

export const usersSchema = z.array(userSchema);

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters").max(200),
  permissions: z.array(z.string()).default([]),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

export type Post = z.infer<typeof postSchema>;
export type PostCategory = z.infer<typeof postCategorySchema>;
export type PostCategoryInput = z.infer<typeof postCategoryInputSchema>;
export type MediaItem = z.infer<typeof mediaSchema>;
export type PostInput = z.infer<typeof postInputSchema>;
export type Teacher = z.infer<typeof teacherSchema>;
export type TeacherInput = z.infer<typeof teacherInputSchema>;
export type Document = z.infer<typeof documentSchema>;
export type DocumentInput = z.infer<typeof documentInputSchema>;
export type Category = z.infer<typeof categorySchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type AdminUser = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type PermissionInfo = z.infer<typeof permissionInfoSchema>;
export type PermissionCatalog = z.infer<typeof permissionCatalogSchema>;
export type UpdateUserInput = {
  name?: string;
  password?: string;
  permissions?: string[];
};
export type LoginInput = z.infer<typeof loginSchema>;

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
