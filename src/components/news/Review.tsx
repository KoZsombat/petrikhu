import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "../../lib/api";
import { ApiError } from "../../lib/api";
import type { ApiUser } from "../../lib/api";
import { STATUS } from "../../../shared/pnw/types";
import type { AuditEntry, ImagePosition, Post, RichTextDocument } from "../../../shared/pnw/types";
import { canManageTerms, canReview, canSubmit } from "../../../shared/pnw/permissions";
import { canEditWorkflowPost } from "../../../shared/pnw/access";
import { statusLabel } from "../../../shared/pnw/statuses";
import { useUsers } from "../../lib/useUsers";
import { btnCls, inputCls } from "../../pages/SchemaForm";
import PostFields from "./PostFields";
import PreviewModal from "./PreviewModal";
import ReadOnlyDetails from "./ReadOnlyDetails";
import AuditTimeline from "./AuditTimeline";
import { asBlocks, hk } from "./helpers";
import { btnDanger, btnPrimary, card, emptyCls, kicker, labelCls } from "./ui";

/** Manager review: editing, approval (immediately or scheduled), return with a note. */
export default function Review({ user, postId }: { user: ApiUser; postId: string }) {
  const navigate = useNavigate();
  const authors = useUsers();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<RichTextDocument>([]);
  const [excerpt, setExcerpt] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [imagePosition, setImagePosition] = useState<ImagePosition>("top");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [publishAt, setPublishAt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getPost(postId), api.getPostAudit(postId)])
      .then(([postResult, auditResult]) => {
        if (cancelled) return;
        const p = postResult.post;
        setPost(p);
        setTitle(p.title);
        setContent(asBlocks(p.content));
        setExcerpt(p.excerpt);
        setCategoryIds(p.categoryIds);
        setTagIds(p.tagIds);
        setImagePosition(p.imagePosition ?? "top");
        setAudit(auditResult.entries);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) return <div className={emptyCls}>Betöltés…</div>;
  if (!post) return <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Ez a hír nem található, vagy nincs hozzáférésed.</div>;

  const author = authors.get(post.authorId);

  if (!canReview(user)) {
    // The author is viewing their own submitted or reviewed post.
    return (
      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className={kicker}>Részletek</div>
            <h1 className="font-display text-3xl font-bold">{post.title}</h1>
          </div>
          {post.status === STATUS.REVISION && canSubmit(user) && canEditWorkflowPost(post, user) && (
            <Link className={btnPrimary} to={hk("edit", post.id)}>
              Hír módosítása
            </Link>
          )}
        </div>
        <ReadOnlyDetails post={post} />
      </section>
    );
  }

  if (post.status !== STATUS.PENDING) {
    return (
      <section className="flex flex-col gap-6">
        <div>
          <div className={kicker}>Vezetői ellenőrzés</div>
          <h1 className="font-display text-3xl font-bold">{post.title}</h1>
          <p className="text-sm text-petriksoft">Beküldő: {author?.displayName ?? "—"}</p>
        </div>
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">Ez a hír már nem vár jóváhagyásra. Aktuális állapot: {statusLabel(post.status)}.</div>
        <ReadOnlyDetails post={post} />
        <div className={card}>
          <h2 className="mb-3 font-display text-xl font-bold">Előzmények</h2>
          <AuditTimeline entries={audit} authors={authors} compact />
        </div>
      </section>
    );
  }

  async function saveReviewerEdits(): Promise<void> {
    setBusy(true);
    try {
      const result = await api.reviewerSave(postId, { title, content, excerpt, categoryIds, tagIds, imagePosition });
      navigate(hk("review", postId, result.notice));
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "save_error";
      navigate(hk("review", postId, code), { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function approve(): Promise<void> {
    setBusy(true);
    try {
      const result = await api.decide(postId, {
        decision: "approve",
        note: reviewNote,
        publishMode,
        publishAt: publishMode === "schedule" && publishAt ? new Date(publishAt).toISOString() : undefined,
      });
      navigate(hk(undefined, undefined, result.notice));
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "save_error";
      navigate(hk("review", postId, code), { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function reject(): Promise<void> {
    if (!rejectNote.trim()) {
      navigate(hk("review", postId, "rejection_note_required"), { replace: true });
      return;
    }
    setBusy(true);
    try {
      const result = await api.decide(postId, { decision: "reject", note: rejectNote });
      navigate(hk(undefined, undefined, result.notice));
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "save_error";
      navigate(hk("review", postId, code), { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <div className={kicker}>Vezetői ellenőrzés</div>
        <h1 className="font-display text-3xl font-bold">{post.title}</h1>
        <p className="text-sm text-petriksoft">Beküldő: {author?.displayName ?? "—"}</p>
      </div>

      <div className={`${card} flex flex-col gap-5`}>
        <PostFields
          editorId="pnw-reviewer-editor"
          title={title}
          onTitleChange={setTitle}
          content={content}
          onContentChange={setContent}
          excerpt={excerpt}
          onExcerptChange={setExcerpt}
          categoryIds={categoryIds}
          onCategoryIdsChange={setCategoryIds}
          tagIds={tagIds}
          onTagIdsChange={setTagIds}
          canCreateTerms={canManageTerms(user)}
          currentImage={post.featuredImage}
          onImageChange={() => {
            /* the manager only edits text/categories; the server reviewer endpoint does not accept images */
          }}
          imagePosition={imagePosition}
          onImagePositionChange={setImagePosition}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-petriklinesoft pt-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnCls} onClick={() => setPreviewOpen(true)}>
              Előnézet
            </button>
            {/* The saved version as a real page, in a new tab. */}
            <a className={btnCls} href={`/hirkezelo/elonezet/${post.id}`} target="_blank" rel="noreferrer">
              Megtekintés publikáltként ↗
            </a>
          </div>
          <button type="button" className={`${btnCls} disabled:opacity-60`} disabled={busy} onClick={saveReviewerEdits}>
            Vezetői módosítások mentése
          </button>
        </div>
      </div>

      <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} title={title} content={content} categoryIds={categoryIds} tagIds={tagIds} image={post.featuredImage} imagePosition={imagePosition} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className={`${card} flex flex-col gap-3 border-t-4! border-t-emerald-500!`}>
          <h2 className="font-display text-xl font-bold">Jóváhagyás</h2>
          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="mb-1 text-sm text-petriksoft">A hír megjelenése</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="pnw-publish-mode" className="accent-petrikaccent" checked={publishMode === "now"} onChange={() => setPublishMode("now")} />
              Azonnal megjelenik a weboldalon
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="pnw-publish-mode" className="accent-petrikaccent" checked={publishMode === "schedule"} onChange={() => setPublishMode("schedule")} />
              Időzítve jelenik meg
            </label>
          </fieldset>
          {publishMode === "schedule" && (
            <label className={labelCls}>
              Megjelenés időpontja
              <input type="datetime-local" className={inputCls} value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
            </label>
          )}
          <textarea rows={3} className={inputCls} placeholder="Opcionális belső megjegyzés" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
          <button type="button" className={`${btnPrimary} self-start`} disabled={busy || (publishMode === "schedule" && !publishAt)} onClick={approve}>
            {publishMode === "schedule" ? "✓ Jóváhagyás és időzítés" : "✓ Jóváhagyás és publikálás"}
          </button>
        </div>
        <div className={`${card} flex flex-col gap-3 border-t-4! border-t-red-500!`}>
          <h2 className="font-display text-xl font-bold">Visszaküldés javításra</h2>
          <p className="text-sm text-petriksoft">A megjegyzést a szerző itt a felületen látja.</p>
          <textarea rows={4} required className={inputCls} placeholder="Mit kell javítani?" value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} />
          <button type="button" className={`${btnDanger} self-start`} disabled={busy} onClick={reject}>
            ↩ Visszaküldés
          </button>
        </div>
      </div>

      <div className={card}>
        <h2 className="mb-3 font-display text-xl font-bold">Előzmények</h2>
        <AuditTimeline entries={audit} authors={authors} compact />
      </div>
    </section>
  );
}
