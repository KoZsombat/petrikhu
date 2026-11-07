import type { ImgHTMLAttributes } from 'react'

/** Images the API can resize: its own uploads and media, raster formats. */
const RESIZABLE = /^\/(uploads|media)\/.+\.(jpe?g|png|webp|avif)$/i
const WIDTHS = [480, 960, 1600]

const srcSet = (src: string, format: 'avif' | 'webp') => WIDTHS.map((w) => `${src}?w=${w}&f=${format} ${w}w`).join(', ')

/**
 * An <img> with AVIF / WebP sources in several widths (made by the API with sharp) for uploaded images.
 * The <picture> wrapper is `display: contents`, so layouts written for a bare <img> are unchanged.
 */
export function Picture({ src, sizes = '100vw', alt = '', ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string; sizes?: string }) {
  if (!RESIZABLE.test(src)) return <img src={src} alt={alt} {...rest} />
  return (
    <picture className="contents">
      <source type="image/avif" srcSet={srcSet(src, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(src, 'webp')} sizes={sizes} />
      <img src={src} alt={alt} {...rest} />
    </picture>
  )
}

/** A small (480 px WebP) version of an uploaded image, for CSS backgrounds. */
export function thumbnail(src: string): string {
  return RESIZABLE.test(src) ? `${src}?w=480&f=webp` : src
}
