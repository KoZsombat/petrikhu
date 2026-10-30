import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "../../lib/api";
import { ApiError } from "../../lib/api";
import type { ApiUser } from "../../lib/api";
import { STATUS } from "../../../shared/pnw/types";
import type { ImagePosition, Post, RichTextDocument } from "../../../shared/pnw/types";
import { emptyDocument } from "../../../shared/pnw/richtext";
import { canManageTerms } from "../../../shared/pnw/permissions";
import { btnCls } from "../../pages/SchemaForm";
import PostFields from "./PostFields";
import PreviewModal from "./PreviewModal";
import { asBlocks, hk } from "./helpers";
import { btnDanger, btnPrimary, card, emptyCls, kicker } from "./ui";

type Props = { user: ApiUser; postId?: string; published?: boolean };

/** Hír írása/szerkesztése (szerző), vagy a kint lévő hír módosítása (published). */
export default function Editor({ user, postId, published }: Props) {
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(!!postId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<RichTextDocument>(emptyDocument());
  const [excerpt, setExcerpt] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [imagePosition, setImagePosition] = useState<ImagePosition>("top");
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    api
      .getPost(postId)
      .then(({ post }) => {
        if (cancelled) return;
        setPost(post);
        setTitle(post.title);
        setContent(asBlocks(post.content));
        setExcerpt(post.excerpt);
        setCategoryIds(post.categoryIds);
        setTagIds(post.tagIds);
        setImagePosition(post.imagePosition ?? "top");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  // A kiválasztott kép blob-címe az előnézeti ablaknak; takarítást kér (revokeObjectURL).
  useEffect(() => {
    if (!image) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModalImageUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(image);
    setModalImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const isRevision = post?.status === STATUS.REVISION;

  if (loading) return <div className={emptyCls}>Betöltés…</div>;
  if (postId && !post) return <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Ez a hír nem található.</div>;

  function buildForm(): FormData {
    const form = new FormData();
    form.set("title", title);
    form.set("content", JSON.stringify(content));
    form.set("excerpt", excerpt);
    form.set("categoryIds", JSON.stringify(categoryIds));
    form.set("tagIds", JSON.stringify(tagIds));
    form.set("imagePosition", imagePosition);
    if (image) form.set("featuredImage", image);
    return form;
  }

  async function submit(command: "draft" | "submit"): Promise<void> {
    setBusy(true);
    try {
      const form = buildForm();
      form.set("command", command);
      const result = postId ? await api.updatePost(postId, form) : await api.createPost(form);
      navigate(command === "draft" ? hk("edit", result.post.id, result.notice) : hk(undefined, undefined, result.notice));
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "save_error";
      navigate(postId ? hk("edit", postId, code) : hk("new", undefined, code), { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function saveChanges(): Promise<void> {
    if (!postId) return;
    setBusy(true);
    try {
      const result = await api.updatePublished(postId, buildForm());
      navigate(hk("published_edit", postId, result.notice));
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "save_error";
      navigate(hk("published_edit", postId, code), { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function archive(): Promise<void> {
    if (!postId) return;
    if (!window.confirm("Biztosan archiválod ezt a jelenleg publikus hírt? Az oldalról azonnal eltűnik, de az Archívumból bármikor visszaállítható.")) return;
    const result = await api.archivePost(postId);
    navigate(hk("published", undefined, result.notice));
  }

  async function removeDraft(): Promise<void> {
    if (!postId) return;
    if (!window.confirm("Biztosan a lomtárba helyezed ezt a piszkozatot?")) return;
    const result = await api.trashPost(postId);
    navigate(hk(undefined, undefined, result.notice));
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className={kicker}>{published ? "Publikált hír" : isRevision ? "Javítás" : post ? "Szerkesztés" : "Új tartalom"}</div>
          <h1 className="font-display text-3xl font-bold">{post ? post.title || "(Névtelen hír)" : "Új hír beküldése"}</h1>
        </div>
        {published && (
          <Link className={btnCls} to={hk("published")}>
            Mégse
          </Link>
        )}
      </div>

      {post?.reviewNote && (
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Vezetői megjegyzés</strong>
          <p className="mt-1">{post.reviewNote}</p>
        </div>
      )}
      {isRevision && <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">Módosítsd a kért részeket, nézd meg az előnézetet, majd küldd vissza újra jóváhagyásra.</div>}

      <div className={`${card} flex flex-col gap-5`}>
        <PostFields
          editorId={published ? "pnw-published-editor" : "pnw-author-editor"}
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
          currentImage={post?.featuredImage}
          onImageChange={setImage}
          imagePosition={imagePosition}
          onImagePositionChange={setImagePosition}
          templates={!published}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-petriklinesoft pt-4">
          <button type="button" className={btnCls} onClick={() => setPreviewOpen(true)}>
            Előnézet
          </button>
          <div className="flex flex-wrap gap-2">
            {published ? (
              <button type="button" className={btnPrimary} disabled={busy} onClick={saveChanges}>
                Módosítások mentése
              </button>
            ) : (
              <>
                <button type="button" className={`${btnCls} disabled:opacity-60`} disabled={busy} onClick={() => submit("draft")}>
                  Piszkozat mentése
                </button>
                <button type="button" className={btnPrimary} disabled={busy} onClick={() => submit("submit")}>
                  {isRevision ? "Újraküldés jóváhagyásra" : "Beküldés jóváhagyásra"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={title}
        content={content}
        categoryIds={categoryIds}
        tagIds={tagIds}
        image={modalImageUrl ?? post?.featuredImage}
        imagePosition={imagePosition}
      />

      {published ? (
        <div>
          <button type="button" className={btnDanger} onClick={archive}>
            Archiválás
          </button>
        </div>
      ) : (
        post && (
          <div>
            <button type="button" className="text-sm text-red-700 underline" onClick={removeDraft}>
              Piszkozat törlése
            </button>
          </div>
        )
      )}
    </section>
  );
}
