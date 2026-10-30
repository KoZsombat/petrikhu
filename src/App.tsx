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

/** Page title: the title of the first PageTitle block. */
function titleOf(blocks: PageBlock[]): string | undefined {
  const title = blocks.find((b) => b.component === "PageTitle")?.values.title;
  return typeof title === "string" ? title : undefined;
}

/**
 * Built-in page in the current language (`forceLang` ties it to one language, e.g. /about-us). If the Creator
 * published a page with the same slug, that overrides the Hungarian version; English shows the translated content.
 */
function BuiltInPage({ slug, forceLang }: { slug: string; forceLang?: Lang }) {
  const { lang: current } = useLang();
  const lang = forceLang ?? current;
  const content = pageBlocks(slug, lang) ?? [];
  const edited = useSiteContent().pages.get(slug);
  const shown = lang === "hu" ? edited : undefined;
  // The tab title is the page name (not the large heading, which is often a slogan): the old site's titles, and their English equivalents.
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

/** /<slug>: a page published in the Creator; 404 if there is none. Built-in pages get their own routes. */
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
  // Not a page published in the Creator: it may be a post at the old /<slug> address (PublishedPost shows the 404 itself).
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
      {/* Every subpage from pages.json: /<slug> */}
      {pageSlugs.map((slug) => (
        <Route key={slug} path={`/${slug}`} element={<BuiltInPage slug={slug} />} />
      ))}
      {/* Old English page: the English version of the Bemutatkozás page */}
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
