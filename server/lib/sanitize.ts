/**
 * The `html` fields of Creator pages (RichText, Feature, Accordion, Callout) are rendered as raw HTML on the site
 * (dangerouslySetInnerHTML), so on save they pass an allowlist filter: no script, event handler, `javascript:` address,
 * unknown tag or attribute may survive. Embedding (iframe) is YouTube only.
 */
import sanitizeHtml from 'sanitize-html'

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 'small', 'sub', 'sup', 'span', 'div',
    'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'iframe',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading', 'data-small'],
    iframe: ['src', 'title', 'allowfullscreen', 'loading'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  allowedIframeHostnames: ['www.youtube-nocookie.com', 'www.youtube.com'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: attribs.target === '_blank' ? { ...attribs, rel: 'noopener noreferrer' } : attribs,
    }),
  },
}

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS)
}
