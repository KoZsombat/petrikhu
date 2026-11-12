import type { Post } from "./api";

const configuredUrl = (
  process.env.PUBLIC_SITE_URL ??
  import.meta.env.PUBLIC_SITE_URL ??
  "https://petrik.hu"
).trim();

/** Canonical origin, without a trailing slash. */
export const SITE_URL = configuredUrl.replace(/\/+$/, "");

export const SITE_NAME = "Petrik Lajos Két Tanítási Nyelvű Technikum";
export const SITE_NAME_EN = "Petrik Lajos Bilingual Technical School";
export const SITE_SHORT_NAME = "Petrik";
export const DEFAULT_OG_IMAGE = "/img/hero-1280.jpg";
export const DEFAULT_OG_IMAGE_WIDTH = 1280;
export const DEFAULT_OG_IMAGE_HEIGHT = 790;
export const SCHOOL_ID = `${SITE_URL}/#school`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** Absolute URL for a site path or an already absolute media URL. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/**
 * Serialise JSON-LD for a <script> tag. Escaping `<`, `>` and `&` keeps
 * user-authored titles/excerpts from closing the script element early.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function schoolJsonLd(locale: "hu" | "en" = "hu") {
  return {
    "@type": ["HighSchool", "EducationalOrganization"],
    "@id": SCHOOL_ID,
    name: locale === "en" ? SITE_NAME_EN : SITE_NAME,
    alternateName: [SITE_SHORT_NAME, "Petrik Lajos Technikum"],
    url: SITE_URL,
    logo: absoluteUrl("/img/logo-416.png"),
    image: absoluteUrl(DEFAULT_OG_IMAGE),
    description:
      locale === "en"
        ? "Bilingual technical school in Budapest: chemistry, environmental protection and IT education since 1879."
        : "Vegyipari, környezetvédelmi és informatikai technikum Budapest szívében, 1879 óta.",
    telephone: "+36 70 502 1724",
    email: "info@petrik.hu",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Thököly út 48–54.",
      postalCode: "1146",
      addressLocality: "Budapest",
      addressCountry: "HU",
    },
  };
}

export function websiteJsonLd(locale: "hu" | "en" = "hu") {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    alternateName: SITE_SHORT_NAME,
    inLanguage: ["hu-HU", "en-GB"],
    publisher: { "@id": SCHOOL_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/kereses?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    ...(locale === "en" ? { description: "Petrik Lajos Bilingual Technical School, Budapest" } : {}),
  };
}

export function articleJsonLd(post: Post) {
  const url = absoluteUrl(`/hirek/${post.slug}`);
  return {
    "@type": "NewsArticle",
    "@id": `${url}#article`,
    headline: post.title,
    description: post.excerpt || undefined,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": SCHOOL_ID },
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    inLanguage: "hu-HU",
    articleSection: post.category || undefined,
    image: [
      ...(post.gallery ?? []).map((url) => absoluteUrl(url)),
      post.image ? absoluteUrl(post.image) : absoluteUrl(DEFAULT_OG_IMAGE),
    ],
  };
}

export function breadcrumbJsonLd(items: { label: string; href?: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}
