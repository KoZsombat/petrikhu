import { Container } from "./Container";
import { cx, linkProps } from "./utils";

export type CtaBandProps = {
  title: string;
  buttonLabel: string;
  href: string;
  className?: string;
};

/** At most one per page, at the bottom. */
export function CtaBand({ title, buttonLabel, href, className }: CtaBandProps) {
  return (
    <section data-component="CtaBand" className={cx("bg-petriktint py-12 md:py-14", className)}>
      <Container className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <h2 className="font-display text-2xl font-bold leading-snug text-balance">{title}</h2>
        <a
          href={href}
          {...linkProps(href)}
          className="inline-block shrink-0 rounded-md bg-petrikaccent px-5 py-[11px] text-[15px] font-semibold text-petrikcard hover:bg-petrikaccentdark"
        >
          {buttonLabel}
        </a>
      </Container>
    </section>
  );
}
