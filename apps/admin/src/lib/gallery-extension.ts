import { Node } from "@tiptap/core";

/**
 * A block-level gallery node. Images are kept in `data-images` so the node can be parsed back
 * from the stored HTML; the rendered HTML is a plain grid of images that the public Prose styles.
 */
export const Gallery = Node.create({
  name: "gallery",
  group: "block",
  atom: true,
  draggable: false,
  selectable: true,

  addAttributes() {
    return {
      images: {
        default: [] as string[],
        parseHTML: (element) => {
          try {
            const value = element.getAttribute("data-images");
            return value ? (JSON.parse(value) as string[]) : [];
          } catch {
            return [];
          }
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-gallery]" }];
  },

  renderHTML({ node }) {
    const images = (node.attrs.images as string[] | undefined) ?? [];
    return [
      "div",
      {
        "data-gallery": "",
        "data-images": JSON.stringify(images),
        class: "post-gallery",
      },
      ...images.map((src) => ["img", { src, alt: "", loading: "lazy" }]),
    ];
  },
});
