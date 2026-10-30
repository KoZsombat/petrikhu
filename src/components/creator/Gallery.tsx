import { Container } from "./Container";
import { cx } from "./utils";

export type GalleryProps = {
  heading?: string;
  columns?: 3 | 4;
  images: { src: string; alt?: string }[];
  className?: string;
  limit?: number;
};

const COLS = { 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" } as const;

/** Image gallery with square, cropped tiles; clicking a tile opens the original image. */
export function Gallery({ heading, columns = 3, images, className, limit }: GalleryProps) {
  return (
    <section data-component="Gallery" className={cx("py-12 md:py-16", className)}>
      <Container>
        {heading && <h2 className="mb-6 font-display text-2xl font-bold text-balance">{heading}</h2>}
        <ul className={cx("grid grid-cols-1 gap-3", COLS[columns])}>
          {(limit === undefined ? images : images.slice(0, limit)).map((image, i) => (
            <li key={i} className="overflow-hidden rounded-lg">
              <a href={image.src} target="_blank" rel="noopener noreferrer">
                <img
                  src={image.src}
                  alt={image.alt ?? ""}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-300 hover:scale-105"
                />
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
