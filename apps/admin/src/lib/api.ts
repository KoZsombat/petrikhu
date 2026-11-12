import {
  categoriesSchema,
  categorySchema,
  createUserSchema,
  documentInputSchema,
  documentSchema,
  documentsSchema,
  postCategoriesSchema,
  postCategoryInputSchema,
  postCategorySchema,
  postInputSchema,
  mediaListSchema,
  mediaSchema,
  myPermissionsSchema,
  permissionCatalogSchema,
  postsSchema,
  postSchema,
  teacherInputSchema,
  teacherSchema,
  teachersSchema,
  userSchema,
  usersSchema,
  type AdminUser,
  type Category,
  type CreateUserInput,
  type MediaItem,
  type Document,
  type DocumentInput,
  type Post,
  type PostCategory,
  type PostCategoryInput,
  type PostInput,
  type PermissionCatalog,
  type UpdateUserInput,
  type Teacher,
  type TeacherInput,
} from "./schemas";
import { API_URL } from "./auth-client";
import { z } from "zod";

const publicCountsSchema = z.object({
  posts: z.number(),
  teachers: z.number(),
  documents: z.number(),
});

/** Counts for the dashboard without requiring editor permissions. */
export async function publicCounts(): Promise<z.infer<typeof publicCountsSchema>> {
  const [postList, teacherList, library] = await Promise.all([
    z
      .object({ total: z.number() })
      .parse(await apiFetch("/api/posts?limit=1")),
    z.array(z.object({ id: z.string() })).parse(await apiFetch("/api/teachers")),
    z
      .object({
        categories: z.array(z.object({ docs: z.array(z.object({ id: z.string() })) })),
      })
      .parse(await apiFetch("/api/documents")),
  ]);

  return publicCountsSchema.parse({
    posts: postList.total,
    teachers: teacherList.length,
    documents: library.categories.reduce((sum, c) => sum + c.docs.length, 0),
  });
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText || "Request failed";

    try {
      const body: unknown = await res.json();
      if (
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
      ) {
        message = body.error;
      }
    } catch {
      // Non-JSON error body, keep the status text.
    }

    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return null;
  }

  return res.json();
}

const json = (body: unknown) => JSON.stringify(body);

/* Posts */
export async function listPosts(): Promise<Post[]> {
  return postsSchema.parse(await apiFetch("/api/admin/posts"));
}

export async function getAdminPost(id: string): Promise<Post> {
  return postSchema.parse(await apiFetch(`/api/admin/posts/${id}`));
}

export async function createPost(input: PostInput): Promise<Post> {
  return postSchema.parse(
    await apiFetch("/api/admin/posts", {
      method: "POST",
      body: json(postInputSchema.parse(input)),
    }),
  );
}

export async function updatePost(
  id: string,
  input: Partial<PostInput>,
): Promise<Post> {
  return postSchema.parse(
    await apiFetch(`/api/admin/posts/${id}`, {
      method: "PUT",
      body: json(postInputSchema.partial().parse(input)),
    }),
  );
}

export async function deletePost(id: string): Promise<void> {
  await apiFetch(`/api/admin/posts/${id}`, { method: "DELETE" });
}

export async function submitPost(id: string): Promise<Post> {
  return postSchema.parse(
    await apiFetch(`/api/admin/posts/${id}/submit`, { method: "POST" }),
  );
}

export async function reviewPost(
  id: string,
  decision: "approve" | "reject",
  note?: string,
): Promise<Post> {
  return postSchema.parse(
    await apiFetch(`/api/admin/posts/${id}/review`, {
      method: "POST",
      body: json({ decision, note }),
    }),
  );
}

/* Media */
export async function listMedia(
  kind: "image" | "document" = "image",
  offset = 0,
  limit = 60,
  q = "",
): Promise<MediaItem[]> {
  const params = new URLSearchParams({
    kind,
    offset: String(offset),
    limit: String(limit),
  });
  if (q.trim()) params.set("q", q.trim());

  return mediaListSchema.parse(
    await apiFetch(`/api/admin/media?${params}`),
  );
}

export async function uploadMedia(file: File): Promise<MediaItem> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_URL}/api/admin/media`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body: unknown = await res.json();
      if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // keep status text
    }
    throw new ApiError(res.status, message);
  }

  return mediaSchema.parse(await res.json());
}

export async function deleteMedia(id: string): Promise<void> {
  await apiFetch(`/api/admin/media/${id}`, { method: "DELETE" });
}

/* Teachers */
export async function listTeachers(): Promise<Teacher[]> {
  return teachersSchema.parse(await apiFetch("/api/admin/teachers"));
}

export async function createTeacher(input: TeacherInput): Promise<Teacher> {
  return teacherSchema.parse(
    await apiFetch("/api/admin/teachers", {
      method: "POST",
      body: json(teacherInputSchema.parse(input)),
    }),
  );
}

export async function updateTeacher(
  id: string,
  input: Partial<TeacherInput>,
): Promise<Teacher> {
  return teacherSchema.parse(
    await apiFetch(`/api/admin/teachers/${id}`, {
      method: "PUT",
      body: json(teacherInputSchema.partial().parse(input)),
    }),
  );
}

export async function deleteTeacher(id: string): Promise<void> {
  await apiFetch(`/api/admin/teachers/${id}`, { method: "DELETE" });
}

/* Documents and categories */
export async function listDocuments(): Promise<Document[]> {
  return documentsSchema.parse(await apiFetch("/api/admin/documents"));
}

export async function listCategories(): Promise<Category[]> {
  return categoriesSchema.parse(
    await apiFetch("/api/admin/document-categories"),
  );
}

export async function createDocument(input: DocumentInput): Promise<Document> {
  return documentSchema.parse(
    await apiFetch("/api/admin/documents", {
      method: "POST",
      body: json(documentInputSchema.parse(input)),
    }),
  );
}

export async function updateDocument(
  id: string,
  input: Partial<DocumentInput>,
): Promise<Document> {
  return documentSchema.parse(
    await apiFetch(`/api/admin/documents/${id}`, {
      method: "PUT",
      body: json(documentInputSchema.partial().parse(input)),
    }),
  );
}

export async function deleteDocument(id: string): Promise<void> {
  await apiFetch(`/api/admin/documents/${id}`, { method: "DELETE" });
}

export async function createCategory(input: {
  slug: string;
  title: string;
  sortOrder: number;
}): Promise<Category> {
  return categorySchema.parse(
    await apiFetch("/api/admin/document-categories", {
      method: "POST",
      body: json(input),
    }),
  );
}

export async function deleteCategory(id: string): Promise<void> {
  await apiFetch(`/api/admin/document-categories/${id}`, { method: "DELETE" });
}

/* Post categories */
export async function listPostCategories(): Promise<PostCategory[]> {
  return postCategoriesSchema.parse(await apiFetch("/api/post-categories"));
}

export async function createPostCategory(input: PostCategoryInput): Promise<PostCategory> {
  return postCategorySchema.parse(
    await apiFetch("/api/admin/post-categories", {
      method: "POST",
      body: json(postCategoryInputSchema.parse(input)),
    }),
  );
}

/* Users */
export async function listUsers(): Promise<AdminUser[]> {
  return usersSchema.parse(await apiFetch("/api/admin/users"));
}

export async function createUser(input: CreateUserInput): Promise<AdminUser> {
  return userSchema.parse(
    await apiFetch("/api/admin/users", {
      method: "POST",
      body: json(createUserSchema.parse(input)),
    }),
  );
}

export async function getMyPermissions(): Promise<{
  permissions: string[];
}> {
  return myPermissionsSchema.parse(await apiFetch("/api/me/permissions"));
}

export async function getPermissionCatalog(): Promise<PermissionCatalog> {
  return permissionCatalogSchema.parse(
    await apiFetch("/api/admin/permissions"),
  );
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<AdminUser> {
  return userSchema.parse(
    await apiFetch(`/api/admin/users/${id}`, {
      method: "PUT",
      body: json(input),
    }),
  );
}

export async function deleteUser(id: string): Promise<void> {
  await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
}
