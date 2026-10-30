import hu from "../pages/samples/pages.json";
import en from "../pages/samples/pages.en.json";
import type { PageBlock } from "../components/creator/PageRenderer";
import type { Lang } from "./languageContext";

const HU = hu as Record<string, PageBlock[]>;
const EN = en as Record<string, PageBlock[]>;

/** Egy beépített oldal blokkjai az adott nyelven; ha nincs angol változat, a magyar. */
export function pageBlocks(slug: string, lang: Lang): PageBlock[] | undefined {
  return (lang === "en" ? EN[slug] : undefined) ?? HU[slug];
}

/** Whether the built-in page has its own English version (otherwise English mode shows the Hungarian one). */
export function hasTranslation(slug: string): boolean {
  return slug in EN;
}

/** Az összes beépített oldal slugja. */
export const pageSlugs = Object.keys(HU);
