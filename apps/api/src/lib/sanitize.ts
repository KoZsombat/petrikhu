import sanitizeHtml from "sanitize-html";

/**
 * Sanitises editor-authored post HTML before it is stored. The public site renders this value with
 * `set:html`, so anything the editor (or an API client holding `posts.update`) submits is untrusted.
 *
 * The allow-list mirrors what the admin editor and the legacy WordPress import produce:
 * headings, lists, links, images, figures, tables and YouTube iframes. Classes and `data-*`
 * attributes are kept because the gallery block (`data-gallery`) and prose styling depend on them.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "span", "div",
    "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "sup", "sub", "mark", "small",
    "ul", "ol", "li", "dl", "dt", "dd",
    "blockquote", "code", "pre",
    "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
    "iframe",
  ],
  allowedAttributes: {
    "*": ["class", "id", "title", "lang", "dir", "data-*"],
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "width", "height", "loading", "decoding"],
    iframe: [
      "src", "width", "height", "title", "allow", "allowfullscreen",
      "frameborder", "loading", "referrerpolicy",
    ],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
    col: ["span"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  allowedIframeHostnames: ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com"],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs:
        attribs.target === "_blank"
          ? { ...attribs, rel: "noopener noreferrer" }
          : attribs,
    }),
  },
};

export const sanitizePostHtml = (html: string | null): string | null => {
  if (html === null) return null;
  return sanitizeHtml(html, OPTIONS);
};
