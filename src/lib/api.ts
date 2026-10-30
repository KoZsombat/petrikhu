/**
 * Vékony fetch-wrapper a szerverhez (server/). Fejlesztésben a Vite proxy
 * (vite.config.ts), élesben ugyanaz az Express folyamat szolgálja ki, ezért a
 * relatív /api/... útvonal mindig jó.
 */
import type { AuditEntry, Capability, Post, Term, TermKind } from "../../shared/pnw/types";
import { rememberTerm } from "./terms";
import type { DocLibrary } from "../../shared/pnw/page-types";
import type {
  CreatorPageStatus,
  CreatorPageSummary,
  MenuItem,
  PageBlock,
  PublicSite,
  StoredCreatorPage,
} from "../../shared/pnw/creator-types";

export type ApiUser = {
  id: string;
  /** Csak a fiókkezelő listában (GET /users) van meg, a munkamenet saját felhasználóján nincs. */
  username?: string;
  displayName: string;
  /** A fiók teljes jogosultsága - szerepkörök nincsenek. */
  permissions: Capability[];
};

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: init?.body && !isForm ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError((data as { error?: string } | null)?.error ?? "unknown_error", response.status);
  }
  return data as T;
}

// --- belépés ------------------------------------------------------------

export const login = (loginValue: string, password: string) =>
  request<{ user: ApiUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ login: loginValue, password }),
  });

export const logout = () => request<{ ok: true }>("/auth/logout", { method: "POST" });

export const me = () => request<{ user: ApiUser }>("/auth/me");

// --- oldalak ------------------------------------------------------------

export type PageInput = {
  title: string;
  slug?: string;
  description: string;
  status: CreatorPageStatus;
  blocks: PageBlock[];
};

export const listPages = () => request<{ pages: CreatorPageSummary[] }>("/pages");

export const getPage = (id: string) => request<{ page: StoredCreatorPage }>(`/pages/${encodeURIComponent(id)}`);

export const createPage = (input: PageInput) =>
  request<{ page: StoredCreatorPage }>("/pages", { method: "POST", body: JSON.stringify(input) });

export const updatePage = (id: string, input: PageInput) =>
  request<{ page: StoredCreatorPage }>(`/pages/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

/** Az első hívás a kukába teszi az oldalt, a kukában lévőn a második véglegesen töröl. */
export const deletePage = (id: string) =>
  request<{ ok: true; permanent: boolean }>(`/pages/${encodeURIComponent(id)}`, { method: "DELETE" });

export const restorePage = (id: string) =>
  request<{ page: StoredCreatorPage }>(`/pages/${encodeURIComponent(id)}/restore`, { method: "POST" });

// --- menü ---------------------------------------------------------------

export const getMenu = () => request<{ menu: MenuItem[] | null; modifiedAt: string | null }>("/pages/menu");

export const saveMenu = (menu: MenuItem[]) =>
  request<{ menu: MenuItem[] }>("/pages/menu", { method: "PUT", body: JSON.stringify({ menu }) });

export const resetMenu = () => request<{ ok: true }>("/pages/menu", { method: "DELETE" });

// --- média --------------------------------------------------------------

export type MediaItem = { url: string; name: string; size: number; modifiedAt: string };

export const listMedia = () => request<{ items: MediaItem[] }>("/pages/media");

export function uploadMedia(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  return request("/pages/media", { method: "POST", body: form });
}

// --- nyilvános ----------------------------------------------------------

export const publicSite = () => request<PublicSite>("/public/site");

// --- Hírkezelő: fiókok ---------------------------------------------------

export type AccountInput = {
  username: string;
  displayName: string;
  permissions: Capability[];
  /** Szerkesztésnél üresen hagyva a jelenlegi jelszó marad. */
  password?: string;
};

export const listUsers = () => request<{ users: ApiUser[] }>("/users");

export const createAccount = (input: AccountInput) =>
  request<{ user: ApiUser }>("/users", { method: "POST", body: JSON.stringify(input) });

export const updateAccount = (id: string, input: AccountInput) =>
  request<{ user: ApiUser }>(`/users/${id}`, { method: "PUT", body: JSON.stringify(input) });

export const deleteAccount = (id: string) => request<{ ok: true }>(`/users/${id}`, { method: "DELETE" });

// --- Hírkezelő: kategóriák és címkék ---------------------------------------

/** Az új elem rögtön bekerül a közös listába (terms.ts), így újratöltés nélkül látszik mindenhol. */
export async function createTerm(kind: TermKind, name: string): Promise<Term> {
  const { term } = await request<{ term: Term }>("/terms", { method: "POST", body: JSON.stringify({ kind, name }) });
  rememberTerm(term);
  return term;
}

// --- Hírkezelő: vezérlőpult ------------------------------------------------

/** `trash`: a lomtárban lévő hírek (a szerzőnek a sajátjai), visszaállíthatók vagy véglegesen törölhetők. */
export type AuthorDashboard = { view: "author"; counts: Record<string, number>; posts: Post[]; trash: Post[] };

export type ReviewerDashboard = {
  view: "reviewer";
  pendingCount: number;
  returnedCount: number;
  scheduledCount: number;
  publishedTodayCount: number;
  ownWorking: Post[];
  pending: Post[];
  scheduled: Post[];
  recent: Post[];
  trash: Post[];
};

export const dashboard = () => request<AuthorDashboard | ReviewerDashboard>("/posts/dashboard");

// --- Hírkezelő: egy hír ----------------------------------------------------

export const getPost = (id: string) => request<{ post: Post }>(`/posts/${id}`);

export const getPostAudit = (id: string) => request<{ entries: AuditEntry[] }>(`/posts/${id}/audit`);

type SaveResponse = { post: Post; notice: string };

export const createPost = (form: FormData) => request<SaveResponse>("/posts", { method: "POST", body: form });

export const updatePost = (id: string, form: FormData) => request<SaveResponse>(`/posts/${id}`, { method: "PUT", body: form });

export const reviewerSave = (
  id: string,
  data: { title: string; content: unknown; excerpt: string; categoryIds: string[]; tagIds: string[]; imagePosition: "top" | "bottom" },
) => request<{ notice: string }>(`/posts/${id}/reviewer`, { method: "PUT", body: JSON.stringify(data) });

export const decide = (
  id: string,
  data: { decision: "approve" | "reject"; note: string; publishMode?: "now" | "schedule"; publishAt?: string },
) => request<{ notice: string }>(`/posts/${id}/decision`, { method: "POST", body: JSON.stringify(data) });

/** Első hívásra a lomtárba tesz, a lomtárban lévő hírt véglegesen törli. */
export const trashPost = (id: string) => request<{ notice: string; permanent: boolean }>(`/posts/${id}`, { method: "DELETE" });
export const untrashPost = (id: string) => request<{ notice: string }>(`/posts/${id}/untrash`, { method: "POST" });

export const updatePublished = (id: string, form: FormData) =>
  request<SaveResponse>(`/posts/${id}/published`, { method: "PUT", body: form });

export const archivePost = (id: string) => request<{ notice: string }>(`/posts/${id}/archive`, { method: "POST" });

export const restorePost = (id: string) => request<{ notice: string }>(`/posts/${id}/restore`, { method: "POST" });

// --- Hírkezelő: kint lévő és archivált hírek ----------------------------------

type ListResponse = { posts: Post[]; total: number; totalPages: number; testMode?: boolean };

export const listPublished = (query: string, page: number) =>
  request<ListResponse>(`/posts/published?q=${encodeURIComponent(query)}&page=${page}`);

export const listArchived = (query: string, page: number) =>
  request<ListResponse>(`/posts/archived?q=${encodeURIComponent(query)}&page=${page}`);

// --- Hírkezelő: napló és statisztika -------------------------------------------

export const fullAuditLog = (limit = 100, imported = false) =>
  request<{ entries: AuditEntry[] }>(`/audit?limit=${limit}${imported ? "&imported=1" : ""}`);

export type Statistics = {
  liveAll: number;
  liveManaged: number;
  scheduled: number;
  pending: number;
  archived: number;
  monthPublished: number;
  averageApprovalSeconds: number;
  monthlyChart: { key: string; count: number }[];
  topAuthors: { key: string; count: number }[];
  topCategories: { key: string; count: number }[];
};

export const statistics = () => request<Statistics>("/statistics");

// --- nyilvános hír ---------------------------------------------------------

export const publicPost = (slug: string) => request<{ post: Post }>(`/public/posts/${encodeURIComponent(slug)}`);

// --- Dokumentumtár --------------------------------------------------------

export const getLibrary = () => request<{ library: DocLibrary | null; modifiedAt: string | null }>("/pages/library");

export const saveLibrary = (library: DocLibrary) =>
  request<{ library: DocLibrary }>("/pages/library", { method: "PUT", body: JSON.stringify({ library }) });

export const resetLibrary = () => request<{ ok: true }>("/pages/library", { method: "DELETE" });

export function uploadLibraryFile(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  return request("/pages/library/file", { method: "POST", body: form });
}

/** Kép a hír szövegébe (a hírkezelő szerkesztőjéből): visszaadja a /uploads/... címet. */
export function uploadPostImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  return request("/posts/media", { method: "POST", body: form });
}
