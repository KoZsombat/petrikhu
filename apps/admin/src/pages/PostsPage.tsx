import {
  Check,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import type { SubmitEvent } from "react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Dialog } from "../components/Dialog";
import { ImageField } from "../components/ImageField";
import { RichTextEditor } from "../components/RichTextEditor";
import { usePermissions } from "../lib/permissions";
import { POST_TEMPLATES } from "../lib/postTemplates";
import {
  createPost,
  createPostCategory,
  deletePost,
  getAdminPost,
  listPostCategories,
  listPosts,
  reviewPost,
  submitPost,
  updatePost,
} from "../lib/api";
import {
  postCategoryInputSchema,
  postInputSchema,
  slugify,
  type Post,
  type PostCategory,
  type PostCategoryInput,
} from "../lib/schemas";
import {
  actions,
  badge,
  badgeLive,
  badgePending,
  button,
  buttonPrimary,
  code,
  empty,
  eyebrow,
  field,
  fieldError,
  form,
  formError,
  formRow,
  iconButton,
  iconButtonDanger,
  input,
  muted,
  page as pageClass,
  pageTitle,
  panel,
  panelTitle,
  table,
  tableWrap,
  td,
  th,
} from "../lib/ui";

type Draft = {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  image: string | null;
  gallery: string[];
};

const emptyDraft: Draft = { title: "", slug: "", excerpt: "", category: "Hírek", image: null, gallery: [] };
type FieldErrors = Record<string, string | undefined>;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium" }).format(new Date(value));

const STATUS_LABEL = {
  draft: "Piszkozat",
  pending: "Jóváhagyásra vár",
  published: "Publikált",
} as const;

const contentToHtml = (post: Post) => {
  if (post.contentHtml) return post.contentHtml;
  const paragraphs = (post.content ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return paragraphs.length
    ? paragraphs.map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`).join("")
    : "<p></p>";
};

export function PostsPage() {
  const permissions = usePermissions();
  const canReview = permissions.has("posts.review");
  const canCreate = permissions.has("posts.create");
  const canUpdate = permissions.has("posts.update");
  const canDelete = permissions.has("posts.delete");
  const canSubmit = permissions.has("posts.submit");

  const [posts, setPosts] = useState<Post[] | null>(null);
  const [categories, setCategories] = useState<PostCategory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<PostCategoryInput>({ title: "", slug: "", sortOrder: 0 });
  const [categorySlugEdited, setCategorySlugEdited] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [contentHtml, setContentHtml] = useState("<p></p>");
  const [plainText, setPlainText] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [templateId, setTemplateId] = useState("blank");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const pageSize = 25;

  const refresh = async () => {
    try {
      setLoadError(null);
      const [postList, categoryList] = await Promise.all([
        listPosts(),
        listPostCategories().catch(() => [] as PostCategory[]),
      ]);
      setPosts(postList);
      setCategories(categoryList);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Betöltési hiba");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const resetForm = () => {
    setDraft(emptyDraft);
    setContentHtml("<p></p>");
    setPlainText("");
    setEditingId(null);
    setTemplateId("blank");
    setSlugEdited(false);
    setFieldErrors({});
    setSubmitError(null);
    setEditorKey((value) => value + 1);
  };

  const openCreate = () => {
    resetForm();
    if (categories.length > 0) {
      setDraft((current) => ({ ...current, category: categories[0].title }));
    }
    setFormOpen(true);
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = POST_TEMPLATES.find((entry) => entry.id === id);
    if (!template || id === "blank") return;

    setDraft((current) => ({
      ...current,
      category: categories.some((entry) => entry.title === template.category)
        ? template.category
        : current.category,
      excerpt: template.excerpt,
    }));
    setContentHtml(template.html);
    setPlainText(template.text);
    setEditorKey((value) => value + 1);
  };

  const openCategoryDialog = () => {
    setCategoryDraft({ title: "", slug: "", sortOrder: categories.length });
    setCategorySlugEdited(false);
    setCategoryError(null);
    setCategoryOpen(true);
  };

  const submitCategory = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCategoryError(null);

    const parsed = postCategoryInputSchema.safeParse(categoryDraft);
    if (!parsed.success) {
      setCategoryError(parsed.error.issues[0]?.message ?? "Érvénytelen kategória");
      return;
    }

    setCategorySaving(true);
    try {
      const created = await createPostCategory(parsed.data);
      setCategories((current) =>
        [...current, created].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "hu")),
      );
      setDraft((current) => ({ ...current, category: created.title }));
      setCategoryOpen(false);
    } catch (cause) {
      setCategoryError(cause instanceof Error ? cause.message : "Mentési hiba");
    } finally {
      setCategorySaving(false);
    }
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    const content = plainText.trim() || draft.title.trim();
    const parsed = postInputSchema.safeParse({ ...draft, content, contentHtml });

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors as FieldErrors);
      return;
    }

    setSaving(true);
    try {
      if (editingId) await updatePost(editingId, parsed.data);
      else await createPost(parsed.data);
      resetForm();
      setFormOpen(false);
      await refresh();
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Mentési hiba");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = async (post: Post) => {
    setBusyId(post.id);
    try {
      const full = await getAdminPost(post.id);
      setEditingId(full.id);
      setSlugEdited(true);
      setDraft({
        title: full.title,
        slug: full.slug,
        excerpt: full.excerpt,
        category: full.category,
        image: full.image,
        gallery: full.gallery ?? [],
      });
      setContentHtml(contentToHtml(full));
      setPlainText(full.content ?? "");
      setFieldErrors({});
      setSubmitError(null);
      setEditorKey((value) => value + 1);
      setFormOpen(true);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Hiba a hír betöltésekor");
    } finally {
      setBusyId(null);
    }
  };

  const submitForReview = async (post: Post) => {
    setBusyId(post.id);
    try {
      await submitPost(post.id);
      await refresh();
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Hiba");
    } finally {
      setBusyId(null);
    }
  };

  const decide = async (post: Post, decision: "approve" | "reject") => {
    const note =
      decision === "reject"
        ? (window.prompt("Miért küldöd vissza? (opcionális)") ?? undefined)
        : undefined;
    setBusyId(post.id);
    try {
      await reviewPost(post.id, decision, note);
      await refresh();
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Hiba");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (post: Post) => {
    if (!window.confirm(`Törlöd: „${post.title}”?`)) return;
    setBusyId(post.id);
    try {
      await deletePost(post.id);
      await refresh();
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Hiba");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = (posts ?? []).filter((post) => {
    const needle = query.trim().toLowerCase();
    return (
      !needle ||
      post.title.toLowerCase().includes(needle) ||
      post.slug.toLowerCase().includes(needle) ||
      post.category.toLowerCase().includes(needle)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const shown = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className={pageClass}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className={eyebrow}>Tartalom</span>
          <h1 className={`mt-1 ${pageTitle}`}>Hírek</h1>
          <p className="mt-1.5 text-[14.5px] text-soft">
            {posts
              ? `${posts.length} hír · ${posts.filter((p) => p.status === "pending").length} jóváhagyásra vár`
              : "Betöltés…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={button} type="button" onClick={() => void refresh()}>
            <RefreshCw className="size-4" aria-hidden /> Frissítés
          </button>
          {canCreate ? (
            <button className={buttonPrimary} type="button" onClick={openCreate}>
              <Plus className="size-4" aria-hidden /> Új hír
            </button>
          ) : null}
        </div>
      </header>

      {loadError ? <p className={formError}>{loadError}</p> : null}

      {!permissions.has("posts.publish") && canCreate ? (
        <p className={muted}>
          Új hírt piszkozatként hozhatsz létre, majd beküldheted jóváhagyásra. Publikálni csak
          jóváhagyó vagy adminisztrátor tud.
        </p>
      ) : null}

      <section className={panel}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className={`${panelTitle} mb-0`}>Összes hír</h2>
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-soft">
            <span className={muted}>Keresés</span>
            <span className="flex items-center gap-2">
              <Search className="size-3.5 text-faint" aria-hidden />
              <input
                className={`${input} min-w-[240px]`}
                type="search"
                value={query}
                placeholder="Cím / slug / kategória"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </span>
          </label>
        </div>

        {posts === null ? (
          <p className={empty}>
            <Loader2 className="mx-auto mb-1 size-4 animate-spin" /> Betöltés…
          </p>
        ) : posts.length === 0 ? (
          <p className={empty}>Még nincs hír.</p>
        ) : (
          <div className={tableWrap}>
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Cím</th>
                  <th className={th}>Kategória</th>
                  <th className={th}>Állapot</th>
                  <th className={th}>Dátum</th>
                  <th className={th} aria-label="Műveletek" />
                </tr>
              </thead>
              <tbody>
                {shown.map((post) => (
                  <tr key={post.id}>
                    <td className={td}>
                      <strong>{post.title}</strong>
                      <div className={code}>/{post.slug}</div>
                      {post.reviewNote ? <div className={code}>Megjegyzés: {post.reviewNote}</div> : null}
                    </td>
                    <td className={td}>{post.category}</td>
                    <td className={td}>
                      <span
                        className={
                          post.status === "published"
                            ? badgeLive
                            : post.status === "pending"
                              ? badgePending
                              : badge
                        }
                      >
                        {STATUS_LABEL[post.status]}
                      </span>
                    </td>
                    <td className={td}>{formatDate(post.createdAt)}</td>
                    <td className={td}>
                      <div className={actions}>
                        {canUpdate ? (
                          <button className={iconButton} type="button" title="Szerkesztés" disabled={busyId === post.id} onClick={() => void startEdit(post)}>
                            <Pencil className="size-3.5" aria-hidden />
                          </button>
                        ) : null}
                        {canSubmit && post.status === "draft" ? (
                          <button
                            className={iconButton}
                            type="button"
                            title="Beküldés jóváhagyásra"
                            disabled={busyId === post.id}
                            onClick={() => void submitForReview(post)}
                          >
                            <Send className="size-3.5" aria-hidden />
                          </button>
                        ) : null}
                        {canReview && post.status === "pending" ? (
                          <>
                            <button
                              className={iconButton}
                              type="button"
                              title="Jóváhagyás"
                              disabled={busyId === post.id}
                              onClick={() => void decide(post, "approve")}
                            >
                              <Check className="size-3.5" aria-hidden />
                            </button>
                            <button
                              className={iconButton}
                              type="button"
                              title="Visszaküldés"
                              disabled={busyId === post.id}
                              onClick={() => void decide(post, "reject")}
                            >
                              <RotateCcw className="size-3.5" aria-hidden />
                            </button>
                          </>
                        ) : null}
                        {canDelete ? (
                          <button
                            className={iconButtonDanger}
                            type="button"
                            title="Törlés"
                            disabled={busyId === post.id}
                            onClick={() => void remove(post)}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > pageSize ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className={muted}>
              {filtered.length} találat · {currentPage}/{totalPages}. oldal
            </span>
            <div className="flex items-center gap-2">
              <button className={button} type="button" disabled={currentPage <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>
                Előző
              </button>
              <button className={button} type="button" disabled={currentPage >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))}>
                Következő
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <Dialog
        open={formOpen}
        title={editingId ? "Hír szerkesztése" : "Új hír"}
        onClose={() => {
          setFormOpen(false);
          resetForm();
        }}
      >
        <form className={form} onSubmit={handleSubmit} noValidate>
          {submitError ? <p className={formError}>{submitError}</p> : null}

          {!editingId ? (
            <label className={field}>
              <span>Sablon</span>
              <select className={input} value={templateId} onChange={(event) => applyTemplate(event.target.value)}>
                {POST_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>{template.label}</option>
                ))}
              </select>
            </label>
          ) : null}

          <label className={field}>
            <span>Cím</span>
            <input
              className={input}
              value={draft.title}
              onChange={(event) => {
                const title = event.target.value;
                setDraft((current) => ({
                  ...current,
                  title,
                  slug: slugEdited ? current.slug : slugify(title),
                }));
              }}
            />
            {fieldErrors.title ? <p className={fieldError}>{fieldErrors.title}</p> : null}
          </label>

          <div className={formRow}>
            <label className={field}>
              <span>Slug</span>
              <input
                className={input}
                value={draft.slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setDraft((current) => ({ ...current, slug: event.target.value }));
                }}
              />
              {fieldErrors.slug ? <p className={fieldError}>{fieldErrors.slug}</p> : null}
            </label>
            <div className={field}>
              <div className="flex items-center justify-between gap-2">
                <span>Kategória</span>
                {canUpdate ? (
                  <button className="text-xs font-semibold text-accent-dark underline-offset-2 hover:underline" type="button" onClick={openCategoryDialog}>
                    + Új kategória
                  </button>
                ) : null}
              </div>
              <select
                className={input}
                value={draft.category}
                onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
              >
                {!categories.some((entry) => entry.title === draft.category) ? (
                  <option value={draft.category}>{draft.category}</option>
                ) : null}
                {categories.map((entry) => (
                  <option key={entry.id} value={entry.title}>{entry.title}</option>
                ))}
              </select>
              {fieldErrors.category ? <p className={fieldError}>{fieldErrors.category}</p> : null}
            </div>
          </div>

          <label className={field}>
            <span>Kivonat</span>
            <input
              className={input}
              value={draft.excerpt}
              onChange={(event) => setDraft((current) => ({ ...current, excerpt: event.target.value }))}
            />
          </label>

          <div className={field}>
            <span>Borítókép</span>
            <ImageField value={draft.image} onChange={(image) => setDraft((current) => ({ ...current, image }))} />
          </div>

          <div className={field}>
            <span>Tartalom</span>
            <RichTextEditor
              key={`${editingId ?? "new"}-${editorKey}`}
              initialContent={contentHtml}
              onChange={(html, text) => {
                setContentHtml(html);
                setPlainText(text);
              }}
            />
            {fieldErrors.content ? <p className={fieldError}>{fieldErrors.content}</p> : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={muted}>
              {editingId
                ? "A mentés nem változtatja meg a hír állapotát."
                : "Az új hír piszkozatként jön létre; beküldés után jóváhagyásra vár."}
            </p>
            <button className={buttonPrimary} type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
              {editingId ? "Mentés" : "Piszkozat létrehozása"}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={categoryOpen}
        title="Új kategória"
        onClose={() => setCategoryOpen(false)}
      >
        <form className={form} onSubmit={submitCategory} noValidate>
          {categoryError ? <p className={formError}>{categoryError}</p> : null}

          <label className={field}>
            <span>Név</span>
            <input
              className={input}
              value={categoryDraft.title}
              onChange={(event) => {
                const title = event.target.value;
                setCategoryDraft((current) => ({
                  ...current,
                  title,
                  slug: categorySlugEdited ? current.slug : slugify(title),
                }));
              }}
            />
          </label>

          <div className={formRow}>
            <label className={field}>
              <span>Slug</span>
              <input
                className={input}
                value={categoryDraft.slug}
                onChange={(event) => {
                  setCategorySlugEdited(true);
                  setCategoryDraft((current) => ({ ...current, slug: event.target.value }));
                }}
              />
            </label>
            <label className={field}>
              <span>Sorrend</span>
              <input
                className={input}
                type="number"
                min={0}
                value={categoryDraft.sortOrder}
                onChange={(event) => setCategoryDraft((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))}
              />
            </label>
          </div>

          <button className={buttonPrimary} type="submit" disabled={categorySaving}>
            {categorySaving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            Kategória létrehozása
          </button>
        </form>
      </Dialog>
    </div>
  );
}
