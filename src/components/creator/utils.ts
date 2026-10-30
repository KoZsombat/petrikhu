import type { AnchorHTMLAttributes } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Külső (http/https) linkek új lapon, noopener noreferrer mellett nyílnak. */
export function linkProps(
  href: string,
): Pick<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel"> {
  return /^https?:/i.test(href)
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
}
