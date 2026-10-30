import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminGate from "../components/AdminGate";
import * as api from "../lib/api";
import type { MediaItem } from "../lib/api";
import builtInPages from "./samples/pages.json";
import builtInLibrary from "./samples/dokumentumtar.json";
import type { DocLibrary } from "../../shared/pnw/page-types";
import type { CreatorPageSummary, MenuItem } from "../../shared/pnw/creator-types";
import { menu as builtInMenu } from "../lib/constants";
import { btnCls, inputCls } from "./SchemaForm";
import AdminHeader from "../components/AdminHeader";

type Tab = "pages" | "menu" | "media" | "library";
const TABS: Record<Tab, string> = { pages: "Oldalak", menu: "Menü", media: "Média", library: "Dokumentumtár" };

export default function Dashboard() {
  return <AdminGate>{(user, logout) => <Panel name={user.displayName} logout={logout} />}</AdminGate>;
}

function Panel({ name, logout }: { name: string; logout: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>("pages");
  return (
    <>
      <AdminHeader title="Szerkesztő" name={name} onLogout={logout} />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <nav className="flex flex-wrap gap-2 border-b border-petriklinesoft pb-6">
          {(Object.keys(TABS) as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${tab === key ? "bg-petrikaccent text-petrikcard" : "border border-petrikline bg-petrikcard text-petriksoft hover:bg-petriktint"}`}
            >
              {TABS[key]}
            </button>
          ))}
          <Link
            to="/hirkezelo"
            className="rounded-md border border-petrikline bg-petrikcard px-4 py-2 text-sm font-semibold text-petriksoft hover:bg-petriktint"
          >
            Hírkezelő →
          </Link>
        </nav>
        {tab === "pages" && <Pages />}
        {tab === "menu" && <MenuEditor />}
        {tab === "media" && <Media />}
        {tab === "library" && <LibraryEditor />}
      </main>
    </>
  );
}

const card = "rounded-lg border border-petrikline bg-petrikcard p-6";

const slugs = new Set(Object.keys(builtInPages));

function Pages() {
  const [pages, setPages] = useState<CreatorPageSummary[] | null>(null);
  const load = useCallback(() => api.listPages().then((r) => setPages(r.pages)), []);
  useEffect(() => {
    load();
  }, [load]);

  const overridden = new Set(pages?.filter((p) => !p.deleted).map((p) => p.slug));
  const reset = async (id: string) => {
    if (!confirm("Visszaállítod az oldalt az eredeti tartalmára? A módosításaid elvesznek.")) return;
    await api.deletePage(id); // kukába
    await api.deletePage(id); // véglegesen
    load();
  };

  return (
    <div className="flex flex-col gap-6">
    <div className={`${card} flex flex-col gap-3`}>
      <Link to="/creator" className="self-start rounded-md bg-petrikaccent px-4 py-2 text-sm font-semibold text-petrikcard hover:bg-petrikaccentdark">
        + Új oldal
      </Link>
      {pages?.length === 0 && <p className="text-sm text-petriksoft">Még nincs mentett oldal.</p>}
      {pages?.map((page) => (
        <div key={page.id} className="flex flex-wrap items-center gap-3 border-t border-petriklinesoft pt-4 text-sm">
          <span className="flex-1 font-semibold">
            {page.title}{" "}
            {slugs.has(page.slug) && <span className="rounded-full bg-petriktint px-2 py-0.5 text-xs font-normal text-petrikaccentdark">beépített oldal módosítva</span>}
            <span className="ml-2 font-mono text-xs font-normal text-petrikfaint">
              /{page.slug} · {page.deleted ? "kukában" : page.status === "publish" ? "kiadva" : "piszkozat"}
            </span>
          </span>
          {!page.deleted && (
            <>
              {page.status === "publish" && (
                <a href={`/${page.slug}`} className={btnCls}>
                  Megnyitás
                </a>
              )}
              <Link to={`/creator?id=${page.id}`} className={btnCls}>
                Szerkesztés
              </Link>
            </>
          )}
          {page.deleted && (
            <button type="button" className={btnCls} onClick={() => api.restorePage(page.id).then(load)}>
              Visszaállítás
            </button>
          )}
          <button
            type="button"
            className={btnCls}
            onClick={() => {
              if (!page.deleted || confirm("Végleg törlöd az oldalt?")) api.deletePage(page.id).then(load);
            }}
          >
            {page.deleted ? "Végleges törlés" : "Kukába"}
          </button>
        </div>
      ))}
    </div>
    <div className={`${card} flex flex-col gap-3`}>
      <h2 className="font-display text-xl font-semibold">Beépített oldalak</h2>
      <p className="text-sm text-petriksoft">A weboldal eredeti oldalai. A szerkesztés létrehoz egy módosított változatot, ami felülírja az eredetit; az eredetihez bármikor vissza lehet térni.</p>
      {Object.entries(builtInPages as Record<string, { component: string; values: { title?: string } }[]>).map(([slug, blocks]) => {
        const saved = pages?.find((p) => p.slug === slug && !p.deleted);
        const title = blocks.find((b) => b.component === "PageTitle")?.values.title ?? slug;
        return (
          <div key={slug} className="flex flex-wrap items-center gap-3 border-t border-petriklinesoft pt-3 text-sm">
            <span className="flex-1 font-semibold">
              {title}
              <span className="ml-2 font-mono text-xs font-normal text-petrikfaint">/{slug}{overridden.has(slug) ? " · módosítva" : ""}</span>
            </span>
            <a href={`/${slug}`} className={btnCls}>
              Megnyitás
            </a>
            <Link to={saved ? `/creator?id=${saved.id}` : `/creator?slug=${slug}`} className={btnCls}>
              Szerkesztés
            </Link>
            {saved && (
              <button type="button" className={btnCls} onClick={() => reset(saved.id)}>
                Eredeti visszaállítása
              </button>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}

function Media() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [error, setError] = useState(false);
  const load = useCallback(() => api.listMedia().then((r) => setItems(r.items)), []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={`${card} flex flex-col gap-4`}>
      <input
        type="file"
        accept="image/*"
        className="text-sm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setError(false);
          api.uploadMedia(file).then(load).catch(() => setError(true));
        }}
      />
      {error && <p className="text-sm text-red-700">A feltöltés nem sikerült (legfeljebb 8 MB, jpg/png/gif/webp/svg/avif).</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.url}
            type="button"
            title="URL másolása"
            onClick={() => navigator.clipboard?.writeText(item.url)}
            className="overflow-hidden rounded-md border border-petrikline text-left"
          >
            <img src={item.url} alt={item.name} className="aspect-square w-full object-cover" />
            <span className="block truncate px-2 py-1 font-mono text-xs text-petriksoft">{item.url}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function slugOf(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "uj";
}

function LibraryEditor() {
  const [library, setLibrary] = useState<DocLibrary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api.getLibrary().then((r) => setLibrary(r.library ?? structuredClone(builtInLibrary as DocLibrary)));
  }, []);
  if (!library) return null;

  const setCategory = (i: number, category: DocLibrary["categories"][number]) =>
    setLibrary({ categories: library.categories.map((c, j) => (j === i ? category : c)) });
  const save = () =>
    api
      .saveLibrary(library)
      .then(() => setNotice("Mentve."))
      .catch(() => setNotice("A tár érvénytelen: minden kategóriának és dokumentumnak kell cím."));
  const reset = () =>
    api.resetLibrary().then(() => {
      setLibrary(structuredClone(builtInLibrary as DocLibrary));
      setNotice("Visszaállítva az eredetire.");
    });

  return (
    <div className={`${card} flex flex-col gap-4`}>
      {library.categories.map((category, i) => (
        <div key={i} className="rounded-lg border border-petrikline bg-petrikcream p-3">
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={category.title}
              placeholder="Kategória"
              onChange={(e) => setCategory(i, { ...category, title: e.target.value, slug: slugOf(e.target.value) })}
            />
            <button type="button" className={btnCls} onClick={() => setLibrary({ categories: library.categories.filter((_, j) => j !== i) })}>
              ×
            </button>
          </div>
          {category.docs.map((doc, k) => (
            <div key={k} className="mt-2 flex flex-wrap items-center gap-2 pl-6">
              <input
                className={`${inputCls} flex-1`}
                value={doc.title}
                placeholder="Dokumentum címe"
                onChange={(e) =>
                  setCategory(i, { ...category, docs: category.docs.map((d, m) => (m === k ? { ...d, title: e.target.value, slug: slugOf(e.target.value) } : d)) })
                }
              />
              <input
                type="file"
                className="text-xs"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const { url } = await api.uploadLibraryFile(file);
                    setCategory(i, { ...category, docs: category.docs.map((d, m) => (m === k ? { ...d, file: url } : d)) });
                  } catch {
                    setNotice("A feltöltés nem sikerült (legfeljebb 9 MB, pdf/office/zip/txt).");
                  }
                }}
              />
              {doc.file && <span className="font-mono text-xs text-petrikfaint">{doc.file}</span>}
              <button type="button" className={btnCls} onClick={() => setCategory(i, { ...category, docs: category.docs.filter((_, m) => m !== k) })}>
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className={`mt-2 ml-6 ${btnCls}`}
            onClick={() => setCategory(i, { ...category, docs: [...category.docs, { slug: "uj", title: "" }] })}
          >
            + Dokumentum
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnCls} onClick={() => setLibrary({ categories: [...library.categories, { slug: "uj", title: "", docs: [] }] })}>
          + Kategória
        </button>
        <span className="flex-1" />
        <button type="button" className={btnCls} onClick={reset}>
          Visszaállítás az eredetire
        </button>
        <button type="button" onClick={save} className="rounded-md bg-petrikaccent px-5 py-1.5 text-sm font-semibold text-petrikcard hover:bg-petrikaccentdark">
          Mentés
        </button>
      </div>
      {notice && <p className="rounded-md bg-petriktint px-3 py-2 text-sm">{notice}</p>}
    </div>
  );
}

const moveItem = <T,>(list: T[], i: number, by: number): T[] => {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

/** A főmenü: elemenként vagy egy link, vagy egy legördülő almenüvel (egy szint). A mentés után legfeljebb egy percig tart, míg a nyilvános oldalon megjelenik. */
function MenuEditor() {
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api.getMenu().then((r) => setMenu(r.menu ?? structuredClone(builtInMenu as MenuItem[])));
  }, []);
  if (!menu) return null;

  const setItem = (i: number, item: MenuItem) => setMenu(menu.map((m, j) => (j === i ? item : m)));
  const save = () =>
    api
      .saveMenu(menu)
      .then(() => setNotice("Mentve. A nyilvános oldalon egy percen belül megjelenik."))
      .catch(() => setNotice("A menü érvénytelen: minden elemnek kell felirat, és /útvonal vagy http(s) cím (legfeljebb 30 elem, elemenként 30 almenüpont)."));
  const reset = () =>
    api.resetMenu().then(() => {
      setMenu(structuredClone(builtInMenu as MenuItem[]));
      setNotice("Visszaállítva az eredetire.");
    });

  return (
    <div className={`${card} flex flex-col gap-4`}>
      {menu.map((item, i) => {
        const group = item.children !== undefined;
        return (
          <div key={i} className="rounded-lg border border-petrikline bg-petrikcream p-3">
            <div className="flex flex-wrap gap-2">
              <input className={`${inputCls} flex-1`} value={item.label} placeholder="Felirat" onChange={(e) => setItem(i, { ...item, label: e.target.value })} />
              {!group && (
                <input className={`${inputCls} flex-1`} value={item.href ?? ""} placeholder="/útvonal vagy https://…" onChange={(e) => setItem(i, { ...item, href: e.target.value })} />
              )}
              <button
                type="button"
                className={btnCls}
                onClick={() => setItem(i, group ? { label: item.label, href: item.children?.[0]?.href ?? "/" } : { label: item.label, children: [] })}
              >
                {group ? "Sima link" : "Almenü"}
              </button>
              <button type="button" className={btnCls} onClick={() => setMenu(moveItem(menu, i, -1))} aria-label="Feljebb">↑</button>
              <button type="button" className={btnCls} onClick={() => setMenu(moveItem(menu, i, 1))} aria-label="Lejjebb">↓</button>
              <button type="button" className={btnCls} onClick={() => setMenu(menu.filter((_, j) => j !== i))} aria-label="Törlés">×</button>
            </div>
            {group && (
              <>
                {item.children!.map((child, k) => {
                  const setChild = (c: typeof child) => setItem(i, { ...item, children: item.children!.map((x, m) => (m === k ? c : x)) });
                  return (
                    <div key={k} className="mt-2 flex flex-wrap gap-2 pl-6">
                      <input className={`${inputCls} flex-1`} value={child.label} placeholder="Felirat" onChange={(e) => setChild({ ...child, label: e.target.value })} />
                      <input className={`${inputCls} flex-1`} value={child.href} placeholder="/útvonal vagy https://…" onChange={(e) => setChild({ ...child, href: e.target.value })} />
                      <button type="button" className={btnCls} onClick={() => setItem(i, { ...item, children: moveItem(item.children!, k, -1) })} aria-label="Feljebb">↑</button>
                      <button type="button" className={btnCls} onClick={() => setItem(i, { ...item, children: moveItem(item.children!, k, 1) })} aria-label="Lejjebb">↓</button>
                      <button type="button" className={btnCls} onClick={() => setItem(i, { ...item, children: item.children!.filter((_, m) => m !== k) })} aria-label="Törlés">×</button>
                    </div>
                  );
                })}
                <button type="button" className={`mt-2 ml-6 ${btnCls}`} onClick={() => setItem(i, { ...item, children: [...item.children!, { label: "", href: "/" }] })}>
                  + Almenüpont
                </button>
              </>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnCls} onClick={() => setMenu([...menu, { label: "", href: "/" }])}>
          + Menüpont
        </button>
        <span className="flex-1" />
        <button type="button" className={btnCls} onClick={reset}>
          Visszaállítás az eredetire
        </button>
        <button type="button" onClick={save} className="rounded-md bg-petrikaccent px-5 py-1.5 text-sm font-semibold text-petrikcard hover:bg-petrikaccentdark">
          Mentés
        </button>
      </div>
      {notice && <p className="rounded-md bg-petriktint px-3 py-2 text-sm">{notice}</p>}
    </div>
  );
}
