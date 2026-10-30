import { Container } from "./Container";
import { useLang } from "../../i18n/languageContext";
import { cx } from "./utils";

export type VideoEmbedProps = {
  heading?: string;
  /** YouTube URL (watch?v=…, youtu.be/… or embed/…). */
  url: string;
  title?: string;
  caption?: string;
  className?: string;
};

/** The YouTube ID from the URL, or undefined if it is not a YouTube link. */
function youtubeId(url: string): string | undefined {
  return /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(url)?.[1];
}

/** Embedded video at 16:9 (youtube-nocookie); a plain link for non-YouTube URLs. */
export function VideoEmbed({ heading, url, title, caption, className }: VideoEmbedProps) {
  const { tr } = useLang();
  const id = youtubeId(url);
  return (
    <section data-component="VideoEmbed" className={cx("py-12 md:py-16", className)}>
      <Container>
        {heading && <h2 className="mx-auto mb-6 max-w-4xl font-display text-2xl font-bold text-balance">{heading}</h2>}
        {id ? (
          <div className="mx-auto aspect-video max-w-4xl overflow-hidden rounded-xl bg-petrikink">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}`}
              title={title ?? tr("Videó")}
              loading="lazy"
              allowFullScreen
              className="size-full border-0"
            />
          </div>
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-petrikaccentdark underline">
            ▶ {title ?? url}
          </a>
        )}
        {caption && <p className="mx-auto mt-3 max-w-4xl text-sm text-petriksoft">{caption}</p>}
      </Container>
    </section>
  );
}
