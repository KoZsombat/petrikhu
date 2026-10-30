import type { ReactNode } from "react";
import { Container } from "./Container";
import { cx } from "./utils";

export type RichTextProps = {
  /**
   * Pre-sanitised HTML.
   * ASSUMPTION: the HTML was already sanitised on the Creator side, so there is no
   * further filtering here. Untrusted content must not be passed in here.
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
          // dangerouslySetInnerHTML is used here (and only here); see the prop comment.
          <div className={classes} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div className={classes}>{children}</div>
        )}
      </Container>
    </section>
  );
}
