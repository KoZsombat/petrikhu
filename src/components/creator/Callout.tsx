import { Container } from "./Container";
import { cx } from "./utils";

export type CalloutProps = {
  title?: string;
  /** Előre megtisztított (sanitizált) HTML. */
  html: string;
  /** `info`: halvány kiemelés, `accent`: telt zöld háttér. */
  tone?: "info" | "accent";
  className?: string;
};

/** Kiemelt közlemény / fontos tudnivaló. */
export function Callout({ title, html, tone = "info", className }: CalloutProps) {
  const accent = tone === "accent";
  return (
    <section data-component="Callout" data-variant={tone} className={cx("py-8 md:py-10", className)}>
      <Container>
        <div
          className={cx(
            "rounded-xl border-l-4 p-6 md:p-8",
            accent ? "border-petrikaccentdark bg-petrikaccent text-petrikcard" : "border-petrikaccent bg-petriktint",
          )}
        >
          {title && <h2 className="mb-3 font-display text-xl font-bold">{title}</h2>}
          <div className={cx("petrik-prose", accent && "[&_a]:text-petrikcard [&_*]:text-petrikcard")} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </Container>
    </section>
  );
}
