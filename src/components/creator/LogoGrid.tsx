import { Container } from "./Container";
import { cx, linkProps } from "./utils";

export type LogoGridProps = {
  label?: string;
  logos: { alt: string; src?: string; href?: string }[];
  className?: string;
  /** Legfeljebb ennyi logót jelenít meg. */
  limit?: number;
};

const TILE =
  "flex h-[78px] items-center justify-center rounded-lg border border-petriklinesoft bg-petrikcard p-2";

export function LogoGrid({ label, logos, className, limit }: LogoGridProps) {
  return (
    <section data-component="LogoGrid" className={cx("py-14 md:py-16", className)}>
      <Container>
        {label && <h2 className="petrik-eyebrow mb-4">{label}</h2>}
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
          {(limit === undefined ? logos : logos.slice(0, limit)).map((logo, i) => {
            const content = logo.src ? (
              <img src={logo.src} alt={logo.alt} className="max-h-[70%] max-w-[70%] object-contain" />
            ) : (
              <span className="px-2 text-center font-mono text-xs text-petrikfaint">{logo.alt}</span>
            );
            return (
              <li key={i}>
                {logo.href ? (
                  <a href={logo.href} {...linkProps(logo.href)} aria-label={logo.alt} className={cx(TILE, "hover:border-petrikline")}>
                    {content}
                  </a>
                ) : (
                  <div className={TILE}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
