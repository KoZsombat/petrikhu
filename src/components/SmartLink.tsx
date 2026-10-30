import { Link } from "react-router-dom";
import type { AnchorHTMLAttributes } from "react";
import { linkProps } from "./creator/utils";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string };

/**
 * A link that navigates client-side when it can: an in-app path ("/hirek") becomes a router <Link> (no full
 * page reload), anything else (http(s), mailto:, tel:, an empty placeholder) stays a plain <a>; http(s)
 * links open in a new tab (linkProps).
 */
export function SmartLink({ href = "", children, ...rest }: Props) {
  if (href.startsWith("/") && !href.startsWith("//")) {
    return (
      <Link to={href} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} {...linkProps(href)} {...rest}>
      {children}
    </a>
  );
}
