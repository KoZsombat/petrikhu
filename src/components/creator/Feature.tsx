import { Container } from "./Container";
import { cx, linkProps } from "./utils";

export type FeatureProps = {
  eyebrow?: string;
  title: string;
  /** Előre megtisztított (sanitizált) HTML, mint a RichText-nél. */
  html?: string;
  image?: { src: string; alt: string };
  /** Melyik oldalon legyen a kép (alapból balra). */
  imageSide?: "left" | "right";
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
};

/** Kép + szöveg két hasábban: bemutatkozó szekciókhoz, váltakozó képoldallal. */
export function Feature({ eyebrow, title, html, image, imageSide = "left", ctaLabel, ctaHref, className }: FeatureProps) {
  return (
    <section data-component="Feature" data-variant={imageSide} className={cx("py-12 md:py-16", className)}>
      <Container className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
        {image && (
          <div className={cx("relative overflow-hidden rounded-xl", imageSide === "right" && "md:order-2")}>
            <img src={image.src} alt={image.alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-petrikaccent" />
          </div>
        )}
        <div className={cx(!image && "md:col-span-2")}>
          {eyebrow && <p className="petrik-eyebrow mb-3">{eyebrow}</p>}
          <h2 className="font-display text-3xl font-bold leading-tight text-balance">{title}</h2>
          {html && <div className="petrik-prose mt-4" dangerouslySetInnerHTML={{ __html: html }} />}
          {ctaLabel && ctaHref && (
            <a
              href={ctaHref}
              {...linkProps(ctaHref)}
              className="mt-6 inline-block rounded-md bg-petrikaccent px-5 py-[11px] text-[15px] font-semibold text-petrikcard hover:bg-petrikaccentdark"
            >
              {ctaLabel}
            </a>
          )}
        </div>
      </Container>
    </section>
  );
}
