import { Link, Route, Routes, useParams } from "react-router-dom";
import Creator from "./pages/Creator";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Preview from "./pages/Preview";
import { PageRenderer, PageTemplate } from "./components";
import type { PageBlock } from "./components";
import { hasTranslation, pageBlocks, pageSlugs } from "./i18n/pages";
import titles from "./pages/samples/pageTitles.json";
import { useLang } from "./i18n/languageContext";
import type { Lang } from "./i18n/languageContext";
import Login from "./pages/Login";
import Search from "./pages/Search";
import Hirkezelo from "./pages/Hirkezelo";
import PublishedPost from "./pages/PublishedPost";
import PostPreviewPage from "./pages/PostPreviewPage";
import Dokumentumtar from "./pages/Dokumentumtar";
import { NewsFeed } from "./components/NewsFeed";
import { useSiteContent } from "./lib/siteContext";
import { useDocumentHead } from "./lib/useDocumentHead";
import ComponentsPreview from "./components/creator/_preview/ComponentsPreview";

function NotFound() {
  const { tr } = useLang();
  useDocumentHead({ title: tr("Az oldal nem található"), noindex: true });
  return (
    <PageTemplate>
      <div className="mx-auto max-w-3xl px-4 py-24">
        <h1 className="text-3xl font-semibold">{tr("Az oldal nem található")}</h1>
        <Link to="/" className="mt-6 inline-block underline">
          {tr("Vissza a kezdőlapra")}
        </Link>
      </div>
    </PageTemplate>
  );
}

/** Shown in English mode above a built-in page that has no English version yet (it falls back to Hungarian). */
function UntranslatedNotice() {
  return (
    <div role="note" className="mx-auto mt-6 max-w-4xl rounded-md border border-petrikline bg-petriktint px-4 py-3 text-sm text-petriksoft">
      This page is not yet available in English; the Hungarian version is shown.
    </div>
  );
}

/** Az oldal címe: az első PageTitle blokk címe. */
function titleOf(blocks: PageBlock[]): string | undefined {
  const title = blocks.find((b) => b.component === "PageTitle")?.values.title;
  return typeof title === "string" ? title : undefined;
}

/**
 * Beépített oldal az aktuális nyelven (a `forceLang` egy adott nyelvhez köti, pl. az /about-us). Ha a szerkesztőben
 * azonos slugú oldalt adtak ki, az felülírja a magyar változatot; az angol a fordított tartalmat mutatja.
 */
function BuiltInPage({ slug, forceLang }: { slug: string; forceLang?: Lang }) {
  const { lang: current } = useLang();
  const lang = forceLang ?? current;
  const content = pageBlocks(slug, lang) ?? [];
  const edited = useSiteContent().pages.get(slug);
  const shown = lang === "hu" ? edited : undefined;
  // A fül címe az oldal neve (nem a nagy cím, ami gyakran szlogen): a régi oldal címei, angolul a megfelelőjük.
  const pageName = (titles as Record<string, { hu: string; en: string }>)[slug]?.[lang];
  useDocumentHead({ title: shown?.title ?? pageName ?? titleOf(content), description: shown?.description });
  return (
    <PageTemplate>
      {lang === "en" && !hasTranslation(slug) && <UntranslatedNotice />}
      {slug === "hirek" && !shown ? (
        <NewsFeed content={content} />
      ) : (
        <PageRenderer content={(shown?.blocks as PageBlock[] | undefined) ?? content} />
      )}
    </PageTemplate>
  );
}

/** A /<slug>: a szerkesztőben kiadott oldal; ha nincs, 404. A beépített oldalak saját útvonalat kapnak. */
function CreatedPage() {
  const { slug = "" } = useParams();
  const { pages, loading } = useSiteContent();
  const page = pages.get(slug);
  useDocumentHead({ title: page?.title, description: page?.description });
  if (page) {
    return (
      <PageTemplate>
        <PageRenderer content={page.blocks as PageBlock[]} />
      </PageTemplate>
    );
  }
  // Nem szerkesztőben kiadott oldal: lehet egy hír a régi /<slug> címén (a PublishedPost maga mutatja a 404-et).
  return loading ? null : <PublishedPost slug={slug} />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PageTemplate>
            <Landing />
          </PageTemplate>
        }
      />
      {/* Minden aloldal a pages.json-ból: /<slug> */}
      {pageSlugs.map((slug) => (
        <Route key={slug} path={`/${slug}`} element={<BuiltInPage slug={slug} />} />
      ))}
      {/* Régi angol oldal: a Bemutatkozás angol változata */}
      <Route path="/about-us" element={<BuiltInPage slug="bemutatkozas" forceLang="en" />} />
      <Route path="/creator" element={<Creator />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/preview" element={<Preview />} />
      <Route path="/components-preview" element={<ComponentsPreview />} />
      <Route path="/dokumentumtar" element={<Dokumentumtar />} />
      <Route path="/hirkezelo" element={<Hirkezelo />} />
      <Route path="/hirkezelo/elonezet/:id" element={<PostPreviewPage />} />
      <Route path="/hirek/:slug" element={<PublishedPost />} />
      <Route path="/kereses" element={<Search />} />
      <Route path="/bejelentkezes" element={<Login />} />
      <Route path="/:slug" element={<CreatedPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
