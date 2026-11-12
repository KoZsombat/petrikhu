import type { PostSummary } from "./api";
import { dateTag } from "./format";
import type { Locale } from "./i18n";

export interface NewsRowData {
  title: string;
  excerpt?: string;
  date: string;
  category?: string;
  image?: { src: string; alt: string };
  href: string;
}

export const PER_PAGE = 10;

/** An API post → the row / card shape the news components render. */
export function toNewsRow(post: PostSummary, locale: Locale = "hu"): NewsRowData {
  return {
    title: post.title,
    excerpt: post.excerpt,
    date: dateTag(post.publishedAt, locale),
    category: post.category || undefined,
    image: post.image ? { src: post.image, alt: post.title } : undefined,
    href: `/hirek/${post.slug}`,
  };
}
