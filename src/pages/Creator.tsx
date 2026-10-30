import { COMPONENTS } from "./creatorSchema";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AdminGate from "../components/AdminGate";
import { ApiError, createPage, getPage, listPages, updatePage } from "../lib/api";
import builtInPages from "./samples/pages.json";
import type { CreatorPageStatus } from "../../shared/pnw/creator-types";
import { PREVIEW_KEY } from "./Preview";
import SchemaForm, { btnCls, inputCls } from "./SchemaForm";
import { emptyValues } from "./creatorSchema";
import AdminHeader from "../components/AdminHeader";

type PageItem = {
  component: string;
  variant?: string;
  values: Record<string, unknown>;
};

export default function Creator() {
  return <AdminGate>{(user, logout) => <CreatorEditor name={user.displayName} logout={logout} />}</AdminGate>;
}

const SAVE_ERRORS: Record<string, string> = {
  missing_title: "Adj címet az oldalnak.",
  invalid_blocks: "Legalább egy blokk kell, és mindegyiknek érvényesnek kell lennie.",
  invalid_slug: "Ez a webcím nem használható (foglalt, üres vagy csak szám).",
  slug_taken: "Ilyen webcímű oldal már van.",
};

function CreatorEditor({ name, logout }: { name: string; logout: () => void }) {
  const navigate = useNavigate();
  // With ?id=..., an already saved page is being edited.
  const [params] = useSearchParams();
  const editId = params.get("id");
  // ?slug=... opens a built-in (pages.json) page; saving creates an overriding page with the same slug.
  const builtInSlug = params.get("slug");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<CreatorPageStatus>("draft");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The whole page JSON: the components already moved past (collapsed).
  const [page, setPage] = useState<PageItem[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [currentName, setCurrentName] = useState("");
  const [currentComponent, setCurrentComponent] = useState<
    (typeof COMPONENTS)[keyof typeof COMPONENTS] | undefined
  >();

  const [currentVariant, setCurrentVariant] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});

  // Without a variant, the base `fields`; with one, the selected variant's fields.
  const activeFields = currentComponent?.variants
    ? currentVariant
      ? currentComponent.variants[currentVariant]
      : undefined
    : currentComponent?.fields;

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    setPage((p) => {
      const copy = [...p];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
    setOpenIndex((o) => (o === i ? j : o === j ? i : o));
  };

  const remove = (i: number) => {
    setPage((p) => p.filter((_, j) => j !== i));
    setOpenIndex((o) => (o === null || o === i ? null : o > i ? o - 1 : o));
  };

  const next = () => {
    if (!currentComponent || !activeFields) return;
    setPage((p) => [
      ...p,
      {
        component: currentName,
        ...(currentVariant ? { variant: currentVariant } : {}),
        values,
      },
    ]);
    setCurrentName("");
    setCurrentComponent(undefined);
    setCurrentVariant("");
    setValues({});
  };

  useEffect(() => {
    if (!builtInSlug || editId) return;
    const blocks = (builtInPages as Record<string, PageItem[]>)[builtInSlug];
    if (!blocks) return;
    // If the built-in page has already been overridden, that override is edited further.
    listPages().then(({ pages }) => {
      const saved = pages.find((p) => p.slug === builtInSlug && !p.deleted);
      if (saved) {
        navigate(`/creator?id=${saved.id}`, { replace: true });
        return;
      }
      const heading = blocks.find((b) => b.component === "PageTitle")?.values.title;
      setTitle(typeof heading === "string" ? heading : builtInSlug);
      setSlug(builtInSlug);
      setStatus("publish");
      setPage(structuredClone(blocks));
    });
  }, [builtInSlug, editId, navigate]);

  useEffect(() => {
    if (!editId) return;
    getPage(editId)
      .then(({ page }) => {
        setTitle(page.title);
        setSlug(page.slug);
        setDescription(page.description);
        setStatus(page.status);
        setPage(page.blocks as PageItem[]);
      })
      .catch(() => setNotice("Az oldal nem tölthető be."));
  }, [editId]);

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const input = { title, slug: slug || undefined, description, status, blocks: page };
      if (editId) {
        await updatePage(editId, input);
        setNotice("Mentve.");
      } else {
        const { page: created } = await createPage(input);
        navigate(`/creator?id=${created.id}`, { replace: true });
      }
    } catch (error) {
      setNotice(SAVE_ERRORS[error instanceof ApiError ? error.code : ""] ?? "A mentés nem sikerült.");
    } finally {
      setSaving(false);
    }
  };

  const primaryBtn =
    "w-full rounded-md bg-petrikaccent px-5 py-[11px] text-[15px] font-semibold text-petrikcard transition-colors hover:bg-petrikaccentdark";
  const iconBtn =
    "px-3 py-2 text-petriksoft transition-colors hover:bg-petriktint hover:text-petrikaccentdark disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="min-h-screen bg-petrikbg font-body text-petrikink">
      <AdminHeader title="Szerkesztő" name={name} onLogout={logout} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div>
          <Link to="/dashboard" className="text-sm text-petrikaccentdark underline">
            ← Vezérlőpult
          </Link>
          <h1 className="font-display text-3xl font-bold">{editId || builtInSlug ? "Oldal szerkesztése" : "Új oldal összeállítása"}</h1>
          <p className="mt-1 text-sm text-petriksoft">
            Válassz komponenst, töltsd ki a mezőket, majd lépj tovább – a blokkok sorrendje később módosítható.
          </p>
        </div>
        <div className="grid gap-3 rounded-lg border border-petrikline bg-petrikcard p-5 sm:grid-cols-2">
          <label className="text-sm font-medium text-petriksoft">
            Cím *
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="text-sm font-medium text-petriksoft">
            Webcím (üresen a címből lesz)
            <input
              className={inputCls}
              value={slug}
              disabled={!!editId || !!builtInSlug}
              placeholder="pl. nyilt-nap"
              onChange={(e) => setSlug(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-petriksoft sm:col-span-2">
            Leírás
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="text-sm font-medium text-petriksoft">
            Állapot
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as CreatorPageStatus)}>
              <option value="draft">Piszkozat</option>
              <option value="publish">Kiadva</option>
            </select>
          </label>
        </div>
        {page.map((item, i) => {
          const schema = COMPONENTS[item.component];
          const fields = item.variant
            ? schema?.variants?.[item.variant]
            : schema?.fields;
          const isOpen = openIndex === i;
          return (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-petrikline bg-petrikcard"
            >
              <div className="flex items-center text-sm">
                <span className="w-9 self-stretch bg-petriktint text-center font-mono text-xs leading-[2.75rem] text-petrikaccentdark">
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex-1 px-3 py-2.5 text-left font-semibold hover:bg-petriktint"
                >
                  {isOpen ? "▾" : "▸"} {schema?.label ?? item.component}
                  <span className="ml-2 font-mono text-xs font-normal text-petrikfaint">
                    {item.component}
                    {item.variant ? ` · ${item.variant}` : ""}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="Fel"
                  className={iconBtn}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === page.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Le"
                  className={iconBtn}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="Törlés"
                  className={iconBtn}
                >
                  ×
                </button>
              </div>
              {isOpen && fields && (
                <form
                  className="border-t border-petriklinesoft p-4"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <SchemaForm
                    fields={fields}
                    values={item.values}
                    onChange={(v) =>
                      setPage((p) =>
                        p.map((x, j) => (j === i ? { ...x, values: v } : x)),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setOpenIndex(null)}
                    className={`mt-4 ${btnCls} w-full`}
                  >
                    Kész
                  </button>
                </form>
              )}
            </div>
          );
        })}
        <div className="flex flex-col gap-3 rounded-lg border border-petrikline bg-petrikcard p-5">
          <p className="font-mono text-xs uppercase tracking-wider text-petrikaccentdark">
            Új blokk
          </p>
          <select
            className={inputCls}
            value={currentName}
            onChange={(e) => {
              setCurrentName(e.target.value);
              const component = COMPONENTS[e.target.value];
              setCurrentComponent(component);
              setCurrentVariant("");
              setValues(component?.fields ? emptyValues(component.fields) : {});
            }}
          >
            <option value="">Válassz egy komponenst</option>
            {Object.entries(COMPONENTS).map(([name, schema]) => (
              <option key={name} value={name}>
                {schema.label} ({name})
              </option>
            ))}
          </select>
          {currentComponent?.variants && (
            <select
              className={inputCls}
              value={currentVariant}
              onChange={(e) => {
                const variant = e.target.value;
                setCurrentVariant(variant);
                setValues(
                  variant ? emptyValues(currentComponent.variants![variant]) : {},
                );
              }}
            >
              <option value="">Válassz egy variánst</option>
              {Object.keys(currentComponent.variants).map((variant) => (
                <option key={variant} value={variant}>
                  {variant}
                </option>
              ))}
            </select>
          )}
          {activeFields && (
            <form onSubmit={(e) => e.preventDefault()}>
              <SchemaForm
                fields={activeFields}
                values={values}
                onChange={setValues}
              />
              <button type="button" onClick={next} className={`mt-4 ${primaryBtn}`}>
                Tovább
              </button>
            </form>
          )}
        </div>
        {(notice || (builtInSlug && !(builtInSlug in builtInPages))) && (
          <p className="rounded-md bg-petriktint px-3 py-2 text-sm">{notice ?? "Nincs ilyen beépített oldal."}</p>
        )}
        {page.length > 0 && (
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className={`${primaryBtn} disabled:opacity-60`}
          >
            {editId ? "Mentés" : builtInSlug ? "Módosítás mentése" : "Oldal létrehozása"}
          </button>
        )}
        {page.length > 0 && (
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(PREVIEW_KEY, JSON.stringify(page));
              window.open("/preview", "_blank");
            }}
            className={btnCls + " w-full py-2.5"}
          >
            Előnézet új lapon
          </button>
        )}
      </main>
    </div>
  );
}
