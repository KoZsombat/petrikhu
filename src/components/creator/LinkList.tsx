import { Container } from "./Container";
import { cx, linkProps } from "./utils";

export type LinkListProps = {
  heading?: string;
  items: { title: string; href?: string; meta?: string }[];
  className?: string;
  limit?: number;
};

/** Linkek / letölthető dokumentumok listája két hasábban, nyíllal. */
export function LinkList({ heading, items, className, limit }: LinkListProps) {
  return (
    <section data-component="LinkList" className={cx("py-12 md:py-16", className)}>
      <Container>
        {heading && <h2 className="mb-6 font-display text-2xl font-bold text-balance">{heading}</h2>}
        <ul className="grid gap-3 md:grid-cols-2">
          {(limit === undefined ? items : items.slice(0, limit)).map((item, i) => (
            <li key={i}>
              {item.href ? (
                <a
                  href={item.href}
                  {...linkProps(item.href)}
                  className="group flex items-center justify-between gap-4 rounded-lg border border-petrikline bg-petrikcard px-5 py-4 transition-colors hover:border-petrikaccent hover:bg-petriktint"
                >
                  <span>
                    <span className="block font-semibold leading-snug">{item.title}</span>
                    {item.meta && <span className="mt-0.5 block text-sm text-petriksoft">{item.meta}</span>}
                  </span>
                  <span aria-hidden="true" className="text-petrikaccentdark transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </a>
              ) : (
                // Link nélküli tétel: csak felsorolás (pl. dokumentum, ami kérésre érhető el).
                <div className="flex items-center gap-3 rounded-lg border border-petriklinesoft bg-petrikcard px-5 py-4">
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-petrikaccent" />
                  <span>
                    <span className="block font-semibold leading-snug">{item.title}</span>
                    {item.meta && <span className="mt-0.5 block text-sm text-petriksoft">{item.meta}</span>}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
