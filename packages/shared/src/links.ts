import { z } from 'zod'

/**
 * Link and media address rules shared by validation and rendering: a root-relative path, or an
 * http(s)/mailto/tel URL. `javascript:` and friends never pass.
 */
export function isSafeHref(href: string): boolean {
  if (href.startsWith('/')) return isLocalPath(href)
  return /^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d][\d\s()-]*)$/i.test(href)
}

/**
 * A path on this site. Browsers treat `//host`, `/\host` and a backslash anywhere in the first segment as another
 * host, and drop tabs and newlines inside URLs (so `/\t/host` is `//host`): none of these pass.
 */
export function isLocalPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return false
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
  if (/[\u0000-\u001f\u007f]/.test(path)) return false
  const firstSegment = path.slice(1).split(/[/?#]/)[0]
  return !firstSegment.includes('\\')
}

/** An image address: an upload/media path or an https/http URL. */
export function isImageSrc(src: string): boolean {
  return isLocalPath(src) || /^https?:\/\/[^\s]+$/i.test(src)
}

const email = z.email()

/** A real e-mail address (zod's rules), e.g. for a `mailto:` link. */
export function isEmail(value: string): boolean {
  return email.safeParse(value).success
}

/** `#rgb`, `#rrggbb`, `rgb()`/`rgba()` or a bare colour keyword - nothing that could break out of a style. */
export function isSafeColor(color: string): boolean {
  return /^(#[0-9a-f]{3,8}|rgba?\([0-9.,\s%]+\)|[a-z]+)$/i.test(color.trim())
}

/** Hosts an embedded frame (video, presentation) may come from. Only https. */
export const EMBED_HOSTS = [
  'www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com', 'sway.office.com', 'sway.cloud.microsoft',
  'www.thinglink.com', 'view.genial.ly', 'view.genially.com', 'online.fliphtml5.com', 'www.facebook.com',
  'docs.google.com', 'www.canva.com', 'padlet.com',
] as const

export function isEmbedSrc(src: string): boolean {
  try {
    const url = new URL(src)
    return url.protocol === 'https:' && (EMBED_HOSTS as readonly string[]).includes(url.hostname)
  } catch {
    return false
  }
}

/** External http(s) links open in a new tab. */
export function isExternal(href: string): boolean {
  return /^https?:/i.test(href)
}

/** The YouTube video id of a watch / youtu.be / embed URL. */
export function youtubeId(url: string): string | undefined {
  return /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(url)?.[1]
}
