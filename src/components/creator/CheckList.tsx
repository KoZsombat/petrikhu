import { Container } from "./Container";
import { cx } from "./utils";

export type CheckListProps = {
  title?: string;
  items: string[];
  /** If sideTitle/sideText is set, the second column is this text; otherwise the list wraps into columns. */
  sideTitle?: string;
  sideText?: string;
  className?: string;
  /** Shows at most this many items. */
  limit?: number;
};

export function CheckList({ title, items, sideTitle, sideText, className, limit }: CheckListProps) {
  const hasSide = Boolean(sideTitle || sideText);
  return (
    <section data-component="CheckList" data-variant={hasSide ? "side" : "columns"} className={cx("py-14 md:py-16", className)}>
      <Container>
        {title && <h2 className="mb-6 font-display text-2xl font-bold text-balance">{title}</h2>}
        <div className={cx(hasSide && "grid gap-8 sm:grid-cols-2 sm:gap-12")}>
          <ul className={cx(!hasSide && "gap-x-12 sm:columns-2")}>
            {(limit === undefined ? items : items.slice(0, limit)).map((item, i) => (
              <li key={i} className="mb-3.5 flex break-inside-avoid items-start gap-3 text-[15px] leading-snug">
                <span
                  aria-hidden="true"
                  className="mt-px flex size-[22px] shrink-0 items-center justify-center rounded-full bg-petriktint text-xs font-bold text-petrikaccentdark"
                >
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {hasSide && (
            <div>
              {sideTitle && <h3 className="petrik-eyebrow mb-2">{sideTitle}</h3>}
              {sideText && <p className="text-[15px] leading-relaxed text-petriksoft">{sideText}</p>}
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
