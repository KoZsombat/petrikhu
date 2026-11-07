/**
 * Link and media address rules shared by validation and rendering: a root-relative path, or an
 * http(s)/mailto/tel URL. `javascript:` and friends never pass.
 */
export function isSafeHref(href: string): boolean {
  if (href.startsWith('/') && !href.startsWith('//')) return true
  return /^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d][\d\s()-]*)$/i.test(href)
}

/** An image address: an upload/media path or an https/http URL. */
export function isImageSrc(src: string): boolean {
  return (src.startsWith('/') && !src.startsWith('//')) || /^https?:\/\/[^\s]+$/i.test(src)
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
