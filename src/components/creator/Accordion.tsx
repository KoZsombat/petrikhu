import { Container } from "./Container";
import { cx } from "./utils";

export type AccordionProps = {
  heading?: string;
  /** `html`: előre megtisztított (sanitizált) HTML. */
  items: { title: string; html: string }[];
  /** Az első elem nyitva legyen-e. */
  openFirst?: boolean;
  className?: string;
};

/** Lenyitható kérdés-válasz / szakaszlista, natív <details>-szel (JS nélkül is működik). */
export function Accordion({ heading, items, openFirst, className }: AccordionProps) {
  return (
    <section data-component="Accordion" className={cx("py-12 md:py-16", className)}>
      <Container>
        {heading && <h2 className="mb-6 font-display text-2xl font-bold text-balance">{heading}</h2>}
        <div className="divide-y divide-petriklinesoft overflow-hidden rounded-xl border border-petrikline bg-petrikcard">
          {items.map((item, i) => (
            <details key={i} open={openFirst && i === 0} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display text-lg font-semibold hover:bg-petriktint [&::-webkit-details-marker]:hidden">
                {item.title}
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-petriktint text-petrikaccentdark transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="petrik-prose px-5 pb-5" dangerouslySetInnerHTML={{ __html: item.html }} />
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
