/**
 * TipTap JSON → JSX, on the server. The node set is the one packages/shared/src/tiptap.ts validates; anything
 * unknown is skipped. No raw HTML anywhere.
 */
import { Fragment } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { isEmbedSrc, isImageSrc, isSafeColor, isSafeHref, youtubeId } from '@petrik/shared/links'
import { YouTube } from './YouTube'
import type { Mark, RichDoc, RichNode } from '@petrik/shared/tiptap'
import { Picture } from './Picture'
import { SmartLink } from './SmartLink'

/** Article typography of news posts (the page blocks use the .petrik-prose class instead). */
export const POST_PROSE =
  'font-body text-[17px] leading-[1.75] text-petrikink break-words ' +
  '[&_p]:mb-4 [&_li>p]:mb-0 [&_h1]:mb-3 [&_h2]:mb-3 [&_h3]:mb-3 [&_h4]:mb-3 [&_h5]:mb-2 [&_h6]:mb-2 ' +
  '[&_h1]:mt-8 [&_h2]:mt-8 [&_h3]:mt-6 [&_h4]:mt-6 [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:font-display [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:font-bold [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:leading-tight ' +
  '[&_.petrik-rich-h1]:mt-8 [&_.petrik-rich-h1]:text-4xl [&_h1]:text-4xl [&_h2]:text-3xl [&_h3]:text-2xl [&_h4]:text-xl [&_h5]:text-lg [&_h6]:text-base ' +
  '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_li>ul]:mt-1 [&_li>ol]:mt-1 ' +
  '[&_blockquote]:mb-4 [&_blockquote]:border-l-4 [&_blockquote]:border-petrikaccent [&_blockquote]:bg-petriktint [&_blockquote]:px-5 [&_blockquote]:py-3 [&_blockquote]:font-display [&_blockquote]:italic ' +
  '[&_a]:font-medium [&_a]:text-petrikaccentdark [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-petrikaccent ' +
  '[&_table]:mb-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[15px] ' +
  '[&_th]:border [&_th]:border-petrikline [&_th]:bg-petriktint [&_th]:px-3 [&_th]:py-2 [&_th]:text-left ' +
  '[&_td]:border [&_td]:border-petrikline [&_td]:px-3 [&_td]:py-2 [&_hr]:my-8 [&_hr]:border-petrikline'

function withMarks(text: ReactNode, marks: Mark[] = []): ReactNode {
  let node = text
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        node = <strong>{node}</strong>
        break
      case 'italic':
        node = <em>{node}</em>
        break
      case 'underline':
        node = <u>{node}</u>
        break
      case 'strike':
        node = <s>{node}</s>
        break
      case 'code':
        node = <code>{node}</code>
        break
      case 'textStyle':
        if (mark.attrs.color && isSafeColor(mark.attrs.color)) node = <span style={{ color: mark.attrs.color }}>{node}</span>
        break
    }
  }
  const link = marks.find((m): m is Extract<Mark, { type: 'link' }> => m.type === 'link')
  return link && isSafeHref(link.attrs.href) ? <SmartLink href={link.attrs.href}>{node}</SmartLink> : node
}

const alignStyle = (align: string | null | undefined): CSSProperties | undefined => (align && align !== 'left' ? { textAlign: align as CSSProperties['textAlign'] } : undefined)

function children(nodes: RichNode[] | undefined, ctx: Ctx): ReactNode {
  return nodes?.map((node, i) => <Fragment key={i}>{render(node, ctx)}</Fragment>)
}

type Ctx = { embedTitle: string; playLabel: (title: string) => string }

function render(node: RichNode, ctx: Ctx): ReactNode {
  switch (node.type) {
    case 'text':
      return withMarks(node.text, node.marks)
    case 'hardBreak':
      return <br />
    case 'horizontalRule':
      return <hr />
    case 'paragraph':
      return <p style={alignStyle(node.attrs?.textAlign)}>{children(node.content, ctx)}</p>
    case 'heading': {
      // The page or post title is the page's only <h1>: a level-1 heading in the text is an <h2> that looks the same.
      if (node.attrs.level === 1) return <h2 className="petrik-rich-h1" style={alignStyle(node.attrs.textAlign)}>{children(node.content, ctx)}</h2>
      const Tag = `h${node.attrs.level}` as 'h2'
      return <Tag style={alignStyle(node.attrs.textAlign)}>{children(node.content, ctx)}</Tag>
    }
    case 'bulletList':
      return <ul>{children(node.content, ctx)}</ul>
    case 'orderedList':
      return <ol start={node.attrs?.start && node.attrs.start !== 1 ? node.attrs.start : undefined}>{children(node.content, ctx)}</ol>
    case 'listItem':
      return <li>{children(node.content, ctx)}</li>
    case 'blockquote':
      return <blockquote>{children(node.content, ctx)}</blockquote>
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table>
            <tbody>{children(node.content, ctx)}</tbody>
          </table>
        </div>
      )
    case 'tableRow':
      return <tr>{children(node.content, ctx)}</tr>
    case 'tableHeader':
      return (
        <th colSpan={node.attrs?.colspan ?? undefined} rowSpan={node.attrs?.rowspan ?? undefined}>
          {children(node.content, ctx)}
        </th>
      )
    case 'tableCell':
      return (
        <td colSpan={node.attrs?.colspan ?? undefined} rowSpan={node.attrs?.rowspan ?? undefined}>
          {children(node.content, ctx)}
        </td>
      )
    case 'image': {
      const { src, alt, caption, href, width, height, textAlign } = node.attrs
      if (!isImageSrc(src)) return null
      const image = <Picture src={src} alt={alt ?? ''} width={width ?? undefined} height={height ?? undefined} loading="lazy" decoding="async" sizes="(min-width: 860px) 820px, 100vw" className="inline-block h-auto max-w-full rounded-md" />
      const align = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : ''
      return (
        <figure className={`mb-6 ${align}`}>
          {href && isSafeHref(href) ? <SmartLink href={href}>{image}</SmartLink> : image}
          {caption && <figcaption className="mt-2 text-sm text-petriksoft">{caption}</figcaption>}
        </figure>
      )
    }
    case 'gallery':
      return (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {node.attrs.items
            .filter((item) => isImageSrc(item.src))
            .map((item, i) => {
              const img = <Picture src={item.src} alt={item.alt} loading="lazy" decoding="async" sizes="(min-width: 768px) 200px, 50vw" className="aspect-[400/284] w-full rounded-md object-cover" />
              return item.full && isImageSrc(item.full) ? (
                <a key={i} href={item.full} target="_blank" rel="noreferrer">
                  {img}
                </a>
              ) : (
                <div key={i}>{img}</div>
              )
            })}
        </div>
      )
    case 'embed': {
      const { src, title, aspect, height } = node.attrs
      if (!isEmbedSrc(src)) return null
      // YouTube (also www.youtube.com in older content): click-to-load, youtube-nocookie only.
      const video = /^https:\/\/www\.youtube(-nocookie)?\.com\//.test(src) ? youtubeId(src) : undefined
      if (video) {
        const name = title ?? ctx.embedTitle
        return (
          <div className="relative my-6 aspect-video overflow-hidden rounded-lg">
            <YouTube id={video} title={name} playLabel={ctx.playLabel(name)} />
          </div>
        )
      }
      const frame = (
        <iframe
          src={src}
          title={title ?? ctx.embedTitle}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className={`block w-full border-0 ${aspect ? 'absolute inset-0 h-full' : ''}`}
          style={aspect ? undefined : { height: height ?? 500 }}
        />
      )
      return (
        <figure className="mb-6">
          {aspect ? (
            <div className="relative h-0" style={{ paddingBottom: `${aspect * 100}%` }}>
              {frame}
            </div>
          ) : (
            frame
          )}
        </figure>
      )
    }
    default:
      return null
  }
}

/** `variant`: `page` for page blocks (.petrik-prose), `post` for a news article, `bare` with no typography. */
export function RichContent({
  doc,
  variant = 'page',
  className = '',
  embedTitle = 'Beágyazott tartalom',
  playLabel = (title: string) => `Videó lejátszása: ${title}`,
}: {
  doc: RichDoc
  variant?: 'page' | 'post' | 'bare'
  className?: string
  embedTitle?: string
  /** The play button's label of an embedded YouTube video. */
  playLabel?: (title: string) => string
}) {
  const base = variant === 'page' ? 'petrik-prose' : variant === 'post' ? POST_PROSE : ''
  return <div className={`${base} ${className}`.trim()}>{children(doc.content, { embedTitle, playLabel })}</div>
}
