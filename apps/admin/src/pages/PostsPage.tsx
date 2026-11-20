import {
  Check,
  History,
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
  badgeRevision,
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
  textarea,
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
type ReviewDecision = "approve" | "reject";

const STATUS_LABEL: Record<Post["status"], string> = {
  draft: "Piszkozat",
  pending: "Jóváhagyásra vár",
  revision: "Javításra visszaküldve",
  published: "Publikált",
};

const AUDIT_LABEL: Record<string, string> = {
  created: "Létrehozva",
  updated: "Módosítva",
  submitted: "Beküldve jóváhagyásra",
  reviewer_edited: "Jóváhagyó szerkesztette",
  rejected: "Visszaküldve javításra",
  approved: "Jóváhagyva és publikálva",
  deleted: "Törölve",
};

const statusBadge = (status: Post["status"]) =>
  status === "published"
    ? badgeLive
    : status === "pending"
      ? badgePending
      : status === "revision"
        ? badgeRevision
        : badge;

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium" }).format(new Date(value))
    : "—";

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );

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
  const canCreate = permissions.has("posts.create");
  const canReview = permissions.has("posts.review");

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
  const [editing, setEditing] = useState<Post | null>(null);
  const [history, setHistory] = useState<Post["history"]>([]);
  const [slugEdited, setSlugEdited] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [review, setReview] = useState<{ post: Post; decision: ReviewDecision } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
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
    setEditing(null);
    setHistory([]);
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
      if (editing) await updatePost(editing.id, parsed.data);
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
      setEditing(full);
      setHistory(full.history ?? []);
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

  const openReview = (post: Post, decision: ReviewDecision) => {
    setReview({ post, decision });
    setReviewNote("");
    setReviewError(null);
  };

  const submitReview = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!review) return;

    const note = reviewNote.trim();
    if (review.decision === "reject" && !note) {
      setReviewError("A visszaküldéshez indoklás kötelező.");
      return;
    }

    setReviewError(null);
    setReviewSaving(true);
    try {
      await reviewPost(review.post.id, review.decision, note || undefined);
      setReview(null);
      await refresh();
    } catch (cause) {
      setReviewError(cause instanceof Error ? cause.message : "Hiba");
    } finally {
      setReviewSaving(false);
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

  const needle = query.trim().toLowerCase();
  const matches = (post: Post) =>
    !needle ||
    post.title.toLowerCase().includes(needle) ||
    post.slug.toLowerCase().includes(needle) ||
    post.category.toLowerCase().includes(needle) ||
    (post.authorName ?? "").toLowerCase().includes(needle);

  const queue = (posts ?? []).filter((post) => post.status === "pending").filter(matches);
  // Pending posts live in the queue above, so the main table never lists them twice.
  const tablePosts = (posts ?? []).filter(
    (post) => (canReview ? post.status !== "pending" : true) && matches(post),
  );
  const totalPages = Math.max(1, Math.ceil(tablePosts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const shown = tablePosts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderActions = (post: Post) => (
    <div className={actions}>
      {post.actions.edit ? (
        <button
          className={iconButton}
          type="button"
          title="Szerkesztés"
          disabled={busyId === post.id}
          onClick={() => void startEdit(post)}
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
      ) : null}
      {post.actions.submit ? (
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
      {post.actions.review ? (
        <>
          <button
            className={iconButton}
            type="button"
            title="Jóváhagyás és publikálás"
            disabled={busyId === post.id}
            onClick={() => openReview(post, "approve")}
          >
            <Check className="size-3.5" aria-hidden />
          </button>
          <button
            className={iconButton}
            type="button"
            title="Visszaküldés javításra"
            disabled={busyId === post.id}
            onClick={() => openReview(post, "reject")}
          >
            <RotateCcw className="size-3.5" aria-hidden />
          </button>
        </>
      ) : null}
      {post.actions.delete ? (
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
  );

  return (
    <div className={pageClass}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className={eyebrow}>Tartalom</span>
          <h1 className={`mt-1 ${pageTitle}`}>Hírek</h1>
          <p className="mt-1.5 text-[14.5px] text-soft">
            {posts
              ? `${posts.length} hír · ${posts.filter((entry) => entry.status === "pending").length} jóváhagyásra vár`
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

      {!canReview && canCreate ? (
        <p className={muted}>
          Új hírt piszkozatként hozhatsz létre, majd beküldheted jóváhagyásra. Beküldés után a hír
          zárolt; visszaküldés esetén a vezetői indoklás mellett szerkesztheted újra.
        </p>
      ) : null}

      <label className="flex max-w-sm flex-col gap-1 text-[12.5px] font-semibold text-soft">
        <span className={muted}>Keresés</span>
        <span className="flex items-center gap-2">
          <Search className="size-3.5 text-faint" aria-hidden />
          <input
            className={input}
            type="search"
            value={query}
            placeholder="Cím / slug / kategória / szerző"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </span>
      </label>

      {canReview ? (
        <section className={panel}>
          <h2 className={panelTitle}>Jóváhagyási sor</h2>
          {queue.length === 0 ? (
            <p className={empty}>Nincs jóváhagyásra váró hír.</p>
          ) : (
            <div className={tableWrap}>
              <table className={table}>
                <thead>
                  <tr>
                    <th className={th}>Cím</th>
                    <th className={th}>Szerző</th>
                    <th className={th}>Kategória</th>
                    <th className={th}>Beküldve</th>
                    <th className={th} aria-label="Műveletek" />
                  </tr>
                </thead>
                <tbody>
                  {queue.map((post) => (
                    <tr key={post.id}>
                      <td className={td}>
                        <strong>{post.title}</strong>
                        <div className={code}>/{post.slug}</div>
                      </td>
                      <td className={td}>{post.authorName ?? "—"}</td>
                      <td className={td}>{post.category}</td>
                      <td className={td}>{formatDate(post.submittedAt)}</td>
                      <td className={td}>{renderActions(post)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <section className={panel}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className={`${panelTitle} mb-0`}>{canReview ? "Összes hír" : "Saját hírek"}</h2>
        </div>

        {posts === null ? (
          <p className={empty}>
            <Loader2 className="mx-auto mb-1 size-4 animate-spin" /> Betöltés…
          </p>
        ) : tablePosts.length === 0 ? (
          <p className={empty}>Még nincs hír.</p>
        ) : (
          <div className={tableWrap}>
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Cím</th>
                  <th className={th}>Szerző</th>
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
                      {post.status === "revision" && post.reviewNote ? (
                        <div className={code}>Visszaküldve: {post.reviewNote}</div>
                      ) : null}
                    </td>
                    <td className={td}>{post.authorName ?? "—"}</td>
                    <td className={td}>{post.category}</td>
                    <td className={td}>
                      <span className={statusBadge(post.status)}>{STATUS_LABEL[post.status]}</span>
                    </td>
                    <td className={td}>{formatDate(post.publishedAt ?? post.createdAt)}</td>
                    <td className={td}>{renderActions(post)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tablePosts.length > pageSize ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className={muted}>
              {tablePosts.length} találat · {currentPage}/{totalPages}. oldal
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
        title={editing ? "Hír szerkesztése" : "Új hír"}
        onClose={() => {
          setFormOpen(false);
          resetForm();
        }}
      >
        <form className={form} onSubmit={handleSubmit} noValidate>
          {submitError ? <p className={formError}>{submitError}</p> : null}

          {editing?.status === "revision" ? (
            <div className={formError}>
              <strong>Javításra visszaküldve.</strong>
              {editing.reviewNote ? <> Indoklás: {editing.reviewNote}</> : null} Javítás után a lista
              nézetben küldheted be újra.
            </div>
          ) : null}

          {!editing ? (
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
                {permissions.has("posts.update") ? (
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
              key={`${editing?.id ?? "new"}-${editorKey}`}
              initialContent={contentHtml}
              onChange={(html, text) => {
                setContentHtml(html);
                setPlainText(text);
              }}
            />
            {fieldErrors.content ? <p className={fieldError}>{fieldErrors.content}</p> : null}
          </div>

          {editing && history.length > 0 ? (
            <div className={field}>
              <span>Előzmények</span>
              <ul className="flex flex-col gap-1.5 text-[12.5px] text-soft">
                {history.map((entry) => (
                  <li key={entry.id}>
                    {formatDateTime(entry.createdAt)} · {AUDIT_LABEL[entry.action] ?? entry.action}
                    {entry.actorName ? ` · ${entry.actorName}` : ""}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={muted}>
              {editing
                ? "A mentés nem változtatja meg a hír állapotát."
                : "Az új hír piszkozatként jön létre; beküldés után jóváhagyásra vár."}
            </p>
            <button className={buttonPrimary} type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
              {editing ? "Mentés" : "Piszkozat létrehozása"}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={review !== null}
        title={review?.decision === "approve" ? "Hír jóváhagyása" : "Visszaküldés javításra"}
        onClose={() => setReview(null)}
      >
        <form className={form} onSubmit={submitReview} noValidate>
          {reviewError ? <p className={formError}>{reviewError}</p> : null}

          <p className="text-[13.5px] text-soft">
            {review?.post.title}
            <span className={code}> · {review?.post.authorName ?? "ismeretlen szerző"}</span>
          </p>

          <label className={field}>
            <span>{review?.decision === "approve" ? "Megjegyzés (nem kötelező)" : "Indoklás (kötelező)"}</span>
            <textarea
              className={textarea}
              rows={4}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={muted}>
              {review?.decision === "approve"
                ? "Jóváhagyás után a hír azonnal publikálásra kerül."
                : "A szerző az indoklást látja, javíthat és újraküldheti a hírt."}
            </p>
            <button className={buttonPrimary} type="submit" disabled={reviewSaving}>
              {reviewSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : review?.decision === "approve" ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <History className="size-4" aria-hidden />
              )}
              {review?.decision === "approve" ? "Jóváhagyás" : "Visszaküldés"}
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
