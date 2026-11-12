/**
 * Server-side reads from the Hono API. Static pages never call this: only news (posts) and the
 * teaching staff (teachers) live in the database.
 */

export interface PostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  image: string | null;
  gallery: string[];
  publishedAt: string;
  updatedAt: string;
}

export interface Post extends PostSummary {
  content: string;
  contentHtml: string | null;
}

export interface PostCategory {
  id: string;
  slug: string;
  title: string;
  sortOrder: number;
}

export interface Teacher {
  id: string;
  name: string;
  role: string;
  email: string | null;
  room: string | null;
  photo: string | null;
}

const API_URL =
  import.meta.env.API_INTERNAL_URL ??
  process.env.API_INTERNAL_URL ??
  "http://localhost:3001";

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API ${path}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getPosts(query: {
  limit?: number;
  offset?: number;
  category?: string;
  q?: string;
} = {}): Promise<{ posts: PostSummary[]; total: number }> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return get<{ posts: PostSummary[]; total: number }>(`/api/posts?${params}`);
}

export async function getPostCategories(): Promise<PostCategory[]> {
  return get<PostCategory[]>("/api/post-categories");
}

export async function getPost(slug: string): Promise<Post | null> {
  const response = await fetch(`${API_URL}/api/posts/${encodeURIComponent(slug)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API post ${slug}: ${response.status}`);
  return response.json() as Promise<Post>;
}

export async function getTeachers(): Promise<Teacher[]> {
  return get<Teacher[]>("/api/teachers");
}

export interface LibraryDoc {
  slug: string;
  title: string;
  file: string | null;
  protected?: boolean;
}

export interface LibraryCategory {
  slug: string;
  title: string;
  docs: LibraryDoc[];
}

export interface Library {
  categories: LibraryCategory[];
}

/** Documents are database content too; an empty database (or a missing endpoint) shows the empty state. */
export async function getDocuments(): Promise<Library> {
  const response = await fetch(`${API_URL}/api/documents`);
  if (response.status === 404) return { categories: [] };
  if (!response.ok) throw new Error(`API documents: ${response.status}`);
  return response.json() as Promise<Library>;
}
