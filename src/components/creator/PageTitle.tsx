import { useLang } from "../../i18n/languageContext";
import { Container } from "./Container";
import { cx, linkProps } from "./utils";

export type PageTitleProps = {
  /** Az utolsó elem az aktuális oldal, annak nincs href-je. */
  breadcrumb: { label: string; href?: string }[];
  title: string;
  intro?: string;
  /** "Borítóképes" változat. */
  cover?: { src: string; alt: string };
  className?: string;
};

export function PageTitle({ breadcrumb, title, intro, cover, className }: PageTitleProps) {
  const { tr } = useLang();
  return (
    <header
      data-component="PageTitle"
      data-variant={cover ? "cover" : "default"}
      className={cx("border-b border-petriklinesoft pt-10 pb-8 md:pt-16 md:pb-12", className)}
    >
      <Container>
        <nav aria-label={tr("Morzsamenü")}>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
            {breadcrumb.map((item, i) => {
              const last = i === breadcrumb.length - 1;
              return (
                <li key={`${i}-${item.label}`} className="flex items-center gap-2">
                  {i > 0 && (
                    <span aria-hidden="true" className="text-petrikfaint">
                      /
                    </span>
                  )}
                  {item.href && !last ? (
                    <a
                      href={item.href}
                      {...linkProps(item.href)}
                      className="text-petrikaccentdark hover:underline"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <span aria-current={last ? "page" : undefined} className="text-petrikfaint">
                      {item.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <h1 className="mt-5 font-display text-[32px] font-bold leading-[1.15] text-balance sm:text-[40px] md:text-[42px]">
          {title}
        </h1>
        {intro && (
          <p className="mt-4 max-w-[66ch] text-[16.5px] leading-relaxed text-petriksoft md:text-[17px]">
            {intro}
          </p>
        )}
        {cover && (
          <img
            src={cover.src}
            alt={cover.alt}
            className="mt-8 aspect-[16/6] w-full rounded-lg object-cover"
          />
        )}
      </Container>
    </header>
  );
}
