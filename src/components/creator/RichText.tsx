import type { ReactNode } from "react";
import { Container } from "./Container";
import { cx } from "./utils";

export type RichTextProps = {
  /**
   * Előre megtisztított (sanitizált) HTML.
   * FELTÉTELEZÉS: a szerkesztő oldalán a HTML-t már sanitizálták, ezért itt nincs
   * további szűrés. Nem megbízható forrásból érkező tartalmat tilos ide adni.
   */
  html?: string;
  children?: ReactNode;
  className?: string;
};

export function RichText({ html, children, className }: RichTextProps) {
  const classes = "petrik-prose";
  return (
    <section data-component="RichText" className={cx("py-14 md:py-16", className)}>
      <Container>
        {html !== undefined ? (
          // Itt (és csak itt) használunk dangerouslySetInnerHTML-t; lásd a prop megjegyzését.
          <div className={classes} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div className={classes}>{children}</div>
        )}
      </Container>
    </section>
  );
}
