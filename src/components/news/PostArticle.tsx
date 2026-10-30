import type { ImagePosition, RichTextDocument } from "../../../shared/pnw/types";
import { isBlank } from "../../../shared/pnw/richtext";
import { termMap, useTerms } from "../../lib/terms";
import { formatPostDate } from "../../lib/postDate";
import RichContent from "../RichContent";
import { useLang } from "../../i18n/languageContext";

type Props = {
  title: string;
  content: RichTextDocument;
  categoryIds: string[];
  image?: string;
  /** Above the text (by default) or below it - the author decides. */
  imagePosition?: ImagePosition;
  date?: string;
};

/**
 * Article view of a post: the same is shown on the public /hirek/:slug page,
 * on the preview page and in the editor's preview window.
 */
export default function PostArticle({ title, content, categoryIds, image, imagePosition = "top", date }: Props) {
  const { lang, tr } = useLang();
  const byId = termMap(useTerms());
  const categories = categoryIds.map((id) => byId.get(id)).filter((term): term is NonNullable<typeof term> => !!term);
  const picture = image && <img src={image} alt="" className="h-auto w-full rounded-lg" />;

  return (
    <article className="mx-auto w-full max-w-[820px] px-5 py-12 sm:px-10 md:py-16" data-component="PostArticle">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-petrikaccentdark">{tr("Hírek")}</p>
      <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-petrikink md:text-5xl">{title || tr("Hír címe")}</h1>
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-[0.15em] text-petrikfaint">
        <time dateTime={date}>{formatPostDate(date ?? new Date().toISOString(), lang)}</time>
        {categories.map((category) => (
          <span key={category.id} className="rounded-full bg-petriktint px-2.5 py-0.5 text-petrikaccentdark">
            {category.name}
          </span>
        ))}
      </p>
      {image && imagePosition === "top" && <div className="mt-8">{picture}</div>}
      <div className="mt-8">{isBlank(content) ? <p className="text-petriksoft">{tr("Még nincs tartalom.")}</p> : <RichContent content={content} />}</div>
      {image && imagePosition === "bottom" && <div className="mt-8">{picture}</div>}
    </article>
  );
}
