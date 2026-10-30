import { Container } from "./Container";
import { useLang } from "../../i18n/languageContext";
import { DateTag } from "./DateTag";
import { cx, linkProps } from "./utils";

export type RowListNewsRow = {
  title: string;
  excerpt?: string;
  date: string;
  category?: string;
  image?: { src: string; alt: string };
  href: string;
};

export type RowListFilter = { label: string; href: string; active?: boolean };

export type RowListPagination = {
  current: number;
  total: number;
  hrefFor: (page: number) => string;
};

export type RowListProps =
  | { variant: "fact"; heading?: string; rows: { label: string; value: string }[]; className?: string; limit?: number }
  | { variant: "step"; heading?: string; rows: { key: string; text: string }[]; className?: string; limit?: number }
  | {
      variant: "news";
      rows: RowListNewsRow[];
      filters?: RowListFilter[];
      pagination?: RowListPagination;
      className?: string;
      limit?: number;
    };

const ROW = "border-t border-petrikline last:border-b";

export function RowList(props: RowListProps) {
  const heading = props.variant === "news" ? undefined : props.heading;
  return (
    <section data-component="RowList" data-variant={props.variant} className={cx("py-14 md:py-16", props.className)}>
      <Container>
        {heading && <h2 className="mb-6 font-display text-2xl font-bold text-balance">{heading}</h2>}

        {props.variant === "fact" && (
          <dl>
            {(props.limit === undefined ? props.rows : props.rows.slice(0, props.limit)).map((row, i) => (
              <div key={i} className={cx(ROW, "grid gap-1 py-3.5 text-[14.5px] sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-6")}>
                <dt className="font-semibold text-petrikink">{row.label}</dt>
                <dd className="text-petriksoft">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {props.variant === "step" && (
          <ol>
            {(props.limit === undefined ? props.rows : props.rows.slice(0, props.limit)).map((row, i) => (
              <li key={i} className={cx(ROW, "grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 py-3.5 text-[14.5px] sm:gap-6")}>
                <span className="font-mono font-bold text-petrikaccentdark">{row.key}</span>
                <span className="text-petriksoft">{row.text}</span>
              </li>
            ))}
          </ol>
        )}

        {props.variant === "news" && <NewsRows {...props} rows={props.limit === undefined ? props.rows : props.rows.slice(0, props.limit)} />}
      </Container>
    </section>
  );
}

function NewsRows({
  rows,
  filters,
  pagination,
}: {
  rows: RowListNewsRow[];
  filters?: RowListFilter[];
  pagination?: RowListPagination;
}) {
  const { tr } = useLang();
  return (
    <>
      {filters && filters.length > 0 && (
        <nav aria-label={tr("Szűrők")} className="mb-8">
          <ul className="flex flex-wrap gap-2">
            {filters.map((f, i) => (
              <li key={i}>
                <a
                  href={f.href}
                  {...linkProps(f.href)}
                  aria-current={f.active ? "true" : undefined}
                  className={cx(
                    "inline-block rounded-full border px-4 py-1.5 text-sm font-medium",
                    f.active
                      ? "border-petrikaccent bg-petrikaccent text-petrikcard"
                      : "border-petrikline bg-petrikcard text-petrikink hover:border-petrikaccent",
                  )}
                >
                  {f.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <ul>
        {rows.map((row, i) => (
          <li key={i} className={ROW}>
            <article className="group relative grid gap-4 py-6 sm:grid-cols-[240px_minmax(0,1fr)] sm:gap-6 md:grid-cols-[240px_minmax(0,1fr)_auto]">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg sm:w-60">
                {row.image ? (
                  <img src={row.image.src} alt={row.image.alt} className="size-full object-cover" />
                ) : (
                  <div aria-hidden="true" className="petrik-stripes size-full" />
                )}
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-petrikaccent" />
              </div>
              <div className="min-w-0">
                <DateTag date={row.date} />
                <h3 className="mt-2.5 font-display text-[19px] font-semibold leading-snug">
                  <a
                    href={row.href}
                    {...linkProps(row.href)}
                    className="after:absolute after:inset-0 after:content-[''] group-hover:text-petrikaccent"
                  >
                    {row.title}
                  </a>
                </h3>
                {row.excerpt && <p className="mt-2 text-sm leading-[1.55] text-petriksoft">{row.excerpt}</p>}
              </div>
              {row.category && (
                <p className="petrik-eyebrow md:self-start md:text-right">{row.category}</p>
              )}
            </article>
          </li>
        ))}
      </ul>

      {pagination && pagination.total > 1 && <Pagination {...pagination} />}
    </>
  );
}

function pageWindow(current: number, total: number): (number | "gap")[] {
  const wanted = new Set<number>([1, total, current - 1, current, current + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

const PAGE_BTN =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-petriklinesoft bg-petrikcard px-3 text-sm font-medium";

function Pagination({ current, total, hrefFor }: RowListPagination) {
  const { tr } = useLang();
  return (
    <nav aria-label={tr("Lapozó")} className="mt-10">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li>
          {current > 1 ? (
            <a href={hrefFor(current - 1)} rel="prev" className={cx(PAGE_BTN, "hover:border-petrikaccent")}>
              ‹ {tr("Előző")}
            </a>
          ) : (
            <span aria-disabled="true" className={cx(PAGE_BTN, "text-petrikfaint")}>
              ‹ {tr("Előző")}
            </span>
          )}
        </li>
        {pageWindow(current, total).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-petrikfaint">
              …
            </li>
          ) : (
            <li key={p}>
              <a
                href={hrefFor(p)}
                aria-current={p === current ? "page" : undefined}
                aria-label={`${p}. oldal`}
                className={cx(
                  PAGE_BTN,
                  p === current ? "border-petrikink bg-petrikink text-petrikcard" : "hover:border-petrikaccent",
                )}
              >
                {p}
              </a>
            </li>
          ),
        )}
        <li>
          {current < total ? (
            <a href={hrefFor(current + 1)} rel="next" className={cx(PAGE_BTN, "hover:border-petrikaccent")}>
              {tr("Következő")} ›
            </a>
          ) : (
            <span aria-disabled="true" className={cx(PAGE_BTN, "text-petrikfaint")}>
              {tr("Következő")} ›
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
