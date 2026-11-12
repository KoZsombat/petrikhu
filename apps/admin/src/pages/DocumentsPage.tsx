import { Check, FolderPlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { SubmitEvent } from "react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Dialog } from "../components/Dialog";
import { DocumentField } from "../components/DocumentField";
import {
  createCategory,
  createDocument,
  deleteCategory,
  deleteDocument,
  listCategories,
  updateDocument,
} from "../lib/api";
import {
  categoryInputSchema,
  documentInputSchema,
  slugify,
  type Category,
  type Document,
  type DocumentInput,
} from "../lib/schemas";
import { usePermissions } from "../lib/permissions";
import {
  actions,
  badge,
  button,
  buttonPrimary,
  checkbox,
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
  page,
  pageTitle,
  panel,
  panelTitle,
  table,
  tableWrap,
  td,
  th,
} from "../lib/ui";

const emptyDocument: DocumentInput = {
  categoryId: "",
  slug: "",
  title: "",
  file: null,
  protected: false,
  sortOrder: 0,
};

type FieldErrors = Record<string, string | undefined>;

export function DocumentsPage() {
  const permissions = usePermissions();
  const canManage = permissions.has("documents.manage");

  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [docDraft, setDocDraft] = useState<DocumentInput>(emptyDocument);
  const [docId, setDocId] = useState<string | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [docErrors, setDocErrors] = useState<FieldErrors>({});
  const [docFormError, setDocFormError] = useState<string | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);

  const [category, setCategory] = useState({ title: "", slug: "", sortOrder: 0 });
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setError(null);
      setCategories(await listCategories());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Betöltési hiba");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const closeDocument = () => {
    setDocOpen(false);
    setDocDraft(emptyDocument);
    setDocId(null);
    setDocErrors({});
    setDocFormError(null);
  };

  const submitDocument = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDocErrors({});
    setDocFormError(null);

    const parsed = documentInputSchema.safeParse(docDraft);
    if (!parsed.success) {
      setDocErrors(z.flattenError(parsed.error).fieldErrors as FieldErrors);
      return;
    }

    setSavingDoc(true);
    try {
      if (docId) await updateDocument(docId, parsed.data);
      else await createDocument(parsed.data);
      closeDocument();
      await refresh();
    } catch (cause) {
      setDocFormError(cause instanceof Error ? cause.message : "Mentési hiba");
    } finally {
      setSavingDoc(false);
    }
  };

  const startEdit = (document: Document) => {
    setDocId(document.id);
    setDocDraft({
      categoryId: document.categoryId,
      slug: document.slug,
      title: document.title,
      file: document.file,
      protected: document.protected,
      sortOrder: document.sortOrder,
    });
    setDocErrors({});
    setDocFormError(null);
    setDocOpen(true);
  };

  const removeDocument = async (document: Document) => {
    if (!window.confirm(`Törlöd: „${document.title}”?`)) return;
    try {
      await deleteDocument(document.id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hiba");
    }
  };

  const closeCategory = () => {
    setCategoryOpen(false);
    setCategory({ title: "", slug: "", sortOrder: 0 });
    setCategoryError(null);
  };

  const submitCategory = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCategoryError(null);

    const parsed = categoryInputSchema.safeParse(category);
    if (!parsed.success) {
      setCategoryError(parsed.error.issues[0]?.message ?? "Érvénytelen kategória");
      return;
    }

    try {
      await createCategory(parsed.data);
      closeCategory();
      await refresh();
    } catch (cause) {
      setCategoryError(cause instanceof Error ? cause.message : "Mentési hiba");
    }
  };

  const removeCategory = async (entry: Category) => {
    if (!window.confirm(`Törlöd a(z) „${entry.title}” kategóriát és a benne lévő ${entry.docs.length} dokumentumot?`)) return;
    try {
      await deleteCategory(entry.id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hiba");
    }
  };

  const allDocuments = categories?.reduce((sum, item) => sum + item.docs.length, 0) ?? 0;

  return (
    <div className={page}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className={eyebrow}>Közzététel</span>
          <h1 className={`mt-1 ${pageTitle}`}>Dokumentumok</h1>
          <p className="mt-1.5 text-[14.5px] text-soft">
            {categories ? `${categories.length} kategória · ${allDocuments} dokumentum` : "Betöltés…"}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <button className={button} type="button" onClick={() => setCategoryOpen(true)}>
              <FolderPlus className="size-4" aria-hidden /> Új kategória
            </button>
            <button className={buttonPrimary} type="button" onClick={() => { setDocDraft(emptyDocument); setDocId(null); setDocOpen(true); }}>
              <Plus className="size-4" aria-hidden /> Új dokumentum
            </button>
          </div>
        ) : null}
      </header>

      {error ? <p className={formError}>{error}</p> : null}

      <section className={panel}>
        <h2 className={panelTitle}>Dokumentumtár</h2>

        {categories === null ? (
          <p className={empty}><Loader2 className="mx-auto mb-1 size-4 animate-spin" /> Betöltés…</p>
        ) : categories.length === 0 ? (
          <p className={empty}>Még nincs kategória.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {categories.map((entry) => (
              <div key={entry.id}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold">
                    {entry.title} <span className={muted}>({entry.docs.length})</span>
                  </h3>
                  {canManage ? (
                    <button className={iconButtonDanger} type="button" title="Kategória törlése" onClick={() => void removeCategory(entry)}>
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>

                {entry.docs.length === 0 ? (
                  <p className={muted}>Nincs dokumentum ebben a kategóriában.</p>
                ) : (
                  <div className={tableWrap}>
                    <table className={table}>
                      <thead>
                        <tr>
                          <th className={th}>Cím</th>
                          <th className={th}>Fájl</th>
                          <th className={th} aria-label="Műveletek" />
                        </tr>
                      </thead>
                      <tbody>
                        {entry.docs.map((document) => (
                          <tr key={document.id}>
                            <td className={td}>{document.title}</td>
                            <td className={td}>
                              {document.file ? (
                                <a className="underline underline-offset-2" href={document.file} target="_blank" rel="noreferrer">
                                  {document.file}
                                </a>
                              ) : (
                                <span className={badge}>Védett</span>
                              )}
                            </td>
                            <td className={td}>
                              {canManage ? (
                                <div className={actions}>
                                  <button className={iconButton} type="button" title="Szerkesztés" onClick={() => startEdit(document)}>
                                    <Pencil className="size-3.5" aria-hidden />
                                  </button>
                                  <button className={iconButtonDanger} type="button" title="Törlés" onClick={() => void removeDocument(document)}>
                                    <Trash2 className="size-3.5" aria-hidden />
                                  </button>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={docOpen} title={docId ? "Dokumentum szerkesztése" : "Új dokumentum"} onClose={closeDocument}>
        <form className={form} onSubmit={submitDocument} noValidate>
          {docFormError ? <p className={formError}>{docFormError}</p> : null}

          <label className={field}>
            <span>Kategória</span>
            <select
              className={input}
              value={docDraft.categoryId}
              onChange={(event) => setDocDraft((current) => ({ ...current, categoryId: event.target.value }))}
            >
              <option value="">Válassz kategóriát…</option>
              {categories?.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.title}</option>
              ))}
            </select>
            {docErrors.categoryId ? <p className={fieldError}>{docErrors.categoryId}</p> : null}
          </label>

          <div className={formRow}>
            <label className={field}>
              <span>Cím</span>
              <input
                className={input}
                value={docDraft.title}
                onChange={(event) => {
                  const title = event.target.value;
                  setDocDraft((current) => ({ ...current, title, slug: current.slug === "" ? slugify(title) : current.slug }));
                }}
              />
              {docErrors.title ? <p className={fieldError}>{docErrors.title}</p> : null}
            </label>
            <label className={field}>
              <span>Slug</span>
              <input className={input} value={docDraft.slug} onChange={(event) => setDocDraft((current) => ({ ...current, slug: event.target.value }))} />
              {docErrors.slug ? <p className={fieldError}>{docErrors.slug}</p> : null}
            </label>
          </div>

          <div className={field}>
            <span>Dokumentum</span>
            <DocumentField
              value={docDraft.file}
              onChange={(file) => setDocDraft((current) => ({ ...current, file, protected: file ? false : true }))}
            />
          </div>

          <div className={formRow}>
            <label className={field}>
              <span>Sorrend</span>
              <input
                className={input}
                type="number"
                min={0}
                value={docDraft.sortOrder}
                onChange={(event) => setDocDraft((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))}
              />
            </label>
            <label className={`${checkbox} self-end`}>
              <input type="checkbox" checked={docDraft.protected} onChange={(event) => setDocDraft((current) => ({ ...current, protected: event.target.checked }))} />
              Védett
            </label>
          </div>

          <button className={buttonPrimary} type="submit" disabled={savingDoc}>
            {savingDoc ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            {docId ? "Mentés" : "Dokumentum létrehozása"}
          </button>
        </form>
      </Dialog>

      <Dialog open={categoryOpen} title="Új kategória" onClose={closeCategory}>
        <form className={form} onSubmit={submitCategory} noValidate>
          {categoryError ? <p className={formError}>{categoryError}</p> : null}

          <label className={field}>
            <span>Cím</span>
            <input
              className={input}
              value={category.title}
              onChange={(event) => {
                const title = event.target.value;
                setCategory((current) => ({ ...current, title, slug: current.slug === "" ? slugify(title) : current.slug }));
              }}
            />
          </label>
          <label className={field}>
            <span>Slug</span>
            <input className={input} value={category.slug} onChange={(event) => setCategory((current) => ({ ...current, slug: event.target.value }))} />
          </label>
          <button className={buttonPrimary} type="submit">
            <FolderPlus className="size-4" aria-hidden /> Kategória létrehozása
          </button>
        </form>
      </Dialog>
    </div>
  );
}
