import Link from 'next/link'
import type { AnchorHTMLAttributes } from 'react'
import { isExternal } from '@petrik/shared/links'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }

/** Files the server streams (uploads, the old site's media): a plain download link, never a client navigation. */
export const isFileHref = (href: string) => /^\/(uploads|media)\//.test(href)

/**
 * In-app paths become a Next.js <Link> (no reload); files, mail, phone and empty placeholders stay a plain
 * <a>; http(s) links open in a new tab.
 */
export function SmartLink({ href = '', children, ...rest }: Props) {
  if (href.startsWith('/') && !href.startsWith('//') && !isFileHref(href)) {
    return (
      <Link href={href} {...rest}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} {...(isExternal(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
      {children}
    </a>
  )
}
