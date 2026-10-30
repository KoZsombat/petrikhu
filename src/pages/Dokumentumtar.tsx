import { useState } from "react";
import { PageRenderer, PageTemplate } from "../components";
import type { PageBlock } from "../components";
import { Container } from "../components/creator/Container";
import { useSiteContent } from "../lib/siteContext";
import { useDocumentHead } from "../lib/useDocumentHead";
import { useLang } from "../i18n/languageContext";
import builtIn from "./samples/dokumentumtar.json";
import type { DocLibrary } from "../../shared/pnw/page-types";

const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** File type from the extension (PDF, DOC…), for the badge. */
const fileType = (file: string) => (/\.([a-z0-9]+)$/i.exec(file)?.[1] ?? "fájl").slice(0, 4).toUpperCase();

/**
 * /dokumentumtar: if a page with the same slug was published in the Creator, that is shown (in Hungarian), like every built-in
 * subpage (BuiltInPage, App.tsx); otherwise the built-in library.
 */
export default function Dokumentumtar() {
  const { lang } = useLang();
  const edited = useSiteContent().pages.get("dokumentumtar");
  const shown = lang === "hu" ? edited : undefined;
  if (shown) return <EditedPage page={shown} />;
  return <Library />;
}

function EditedPage({ page }: { page: { title: string; description: string; blocks: unknown[] } }) {
  useDocumentHead({ title: page.title, description: page.description });
  return (
    <PageTemplate>
      <PageRenderer content={page.blocks as PageBlock[]} />
    </PageTemplate>
  );
}

/** Documents by category, with search and a side category menu; a library saved in the Creator overrides the built-in one. */
function Library() {
  const { tr } = useLang();
  useDocumentHead({ title: tr("Dokumentumtár") });
  const library: DocLibrary = useSiteContent().library ?? (builtIn as DocLibrary);
  const [q, setQ] = useState("");
  const needle = fold(q.trim());

  const categories = library.categories
    .map((c) => ({ ...c, docs: c.docs.filter((d) => !needle || fold(d.title).includes(needle)) }))
    .filter((c) => c.docs.length > 0);
  const total = categories.reduce((n, c) => n + c.docs.length, 0);

  return (
    <PageTemplate>
      <Container className="py-12 md:py-16">
        <p className="petrik-eyebrow mb-3">{tr("Petrik Lajos Két Tanítási Nyelvű Technikum")}</p>
        <h1 className="font-display text-4xl font-bold md:text-5xl">{tr("Dokumentumtár")}</h1>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={q}
            placeholder={tr("Keresés a dokumentumok között…")}
            onChange={(e) => setQ(e.target.value)}
            className="block w-full max-w-xl rounded-md border border-petrikline bg-petrikcard px-4 py-2.5 text-[15px] focus:border-petrikaccent focus:outline-none focus:ring-2 focus:ring-petrikaccent/25"
          />
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-petriksoft">
            {total} {tr("dokumentum")}
          </span>
        </div>

        <div className="mt-10 grid gap-10 md:grid-cols-[240px_minmax(0,1fr)] md:gap-14">
          <nav aria-label={tr("Kategóriák")} className="md:sticky md:top-28 md:self-start">
            <p className="petrik-eyebrow mb-3">{tr("Kategóriák")}</p>
            <ul className="flex flex-wrap gap-2 md:flex-col md:gap-0.5">
              {categories.map((c) => (
                <li key={c.slug}>
                  <a
                    href={`#${c.slug}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-petriklinesoft bg-petrikcard px-3 py-1.5 text-sm hover:border-petrikaccent hover:bg-petriktint md:border-transparent md:bg-transparent"
                  >
                    <span>{tr(c.title)}</span>
                    <span className="font-mono text-xs text-petrikfaint">{c.docs.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-10">
            {categories.map((category) => (
              <section key={category.slug} id={category.slug} className="scroll-mt-28">
                <h2 className="mb-4 border-b border-petrikline pb-2 font-display text-2xl font-bold">{tr(category.title)}</h2>
                <ul className="grid gap-2.5">
                  {category.docs.map((doc) => (
                    <li key={doc.slug}>
                      {doc.file ? (
                        <a
                          href={doc.file}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-4 rounded-lg border border-petrikline bg-petrikcard px-4 py-3.5 transition-colors hover:border-petrikaccent hover:bg-petriktint"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-petriktint font-mono text-[11px] font-medium text-petrikaccentdark group-hover:bg-petrikcard">
                            {fileType(doc.file)}
                          </span>
                          <span className="min-w-0 flex-1 font-semibold leading-snug text-petrikink">{doc.title}</span>
                          <span className="font-mono text-xs uppercase tracking-[0.15em] text-petrikaccentdark">{tr("Letöltés")} ↓</span>
                        </a>
                      ) : (
                        <div className="flex items-center gap-4 rounded-lg border border-petriklinesoft bg-petrikcard px-4 py-3.5 text-petriksoft">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-petrikcream font-mono text-[11px]">🔒</span>
                          <span className="min-w-0 flex-1 leading-snug">{doc.title}</span>
                          <span className="font-mono text-xs uppercase tracking-[0.15em]">{tr("Védett")}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {categories.length === 0 && <p className="text-sm text-petriksoft">{tr("Nincs találat.")}</p>}
          </div>
        </div>
      </Container>
    </PageTemplate>
  );
}
