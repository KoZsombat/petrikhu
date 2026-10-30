/**
 * A Creator-oldalak `html` mezői (RichText, Feature, Accordion, Callout) nyers HTML-ként jelennek meg az oldalon
 * (dangerouslySetInnerHTML), ezért mentéskor fehérlistás szűrőn mennek át: szkript, eseménykezelő, `javascript:` cím,
 * ismeretlen címke vagy attribútum nem maradhat. Beágyazás (iframe) csak YouTube-ról.
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
