import type { AnchorHTMLAttributes } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** External (http/https) links open in a new tab with noopener noreferrer. */
export function linkProps(
  href: string,
): Pick<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel"> {
  return /^https?:/i.test(href)
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
}
