import { Fragment } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { RichTextBlock, RichTextDocument, TextRun } from "../../shared/pnw/types";
import { RICH_STYLE_KEYS, isEmbedSrc } from "../../shared/pnw/types";
import { isSafeHref } from "../../shared/pnw/richtext";
import { isFileHref, isLegacyBlocks, isValidStyleValue, toRichContent } from "../../shared/pnw/rich-content";
import type { RichNode } from "../../shared/pnw/rich-content";

/** A cikk szövegének tipográfiája: a wrapper osztály formáz minden belső elemet. */
export const proseCls =
  "font-body text-[17px] leading-[1.75] text-petrikink break-words " +
  "[&_p]:mb-4 [&_h1]:mb-3 [&_h2]:mb-3 [&_h3]:mb-3 [&_h4]:mb-3 [&_h5]:mb-2 [&_h6]:mb-2 " +
  "[&_h1]:mt-8 [&_h2]:mt-8 [&_h3]:mt-6 [&_h4]:mt-6 [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:font-display [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:font-bold [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:leading-tight " +
  "[&_h1]:text-4xl [&_h2]:text-3xl [&_h3]:text-2xl [&_h4]:text-xl [&_h5]:text-lg [&_h6]:text-base " +
  "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_li>ul]:mt-1 [&_li>ol]:mt-1 " +
  "[&_blockquote]:mb-4 [&_blockquote]:border-l-4 [&_blockquote]:border-petrikaccent [&_blockquote]:bg-petriktint [&_blockquote]:px-5 [&_blockquote]:py-3 [&_blockquote]:font-display [&_blockquote]:italic " +
  "[&_a]:font-medium [&_a]:text-petrikaccentdark [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-petrikaccent " +
  "[&_table]:mb-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[15px] " +
  "[&_th]:border [&_th]:border-petrikline [&_th]:bg-petriktint [&_th]:px-3 [&_th]:py-2 [&_th]:text-left " +
  "[&_td]:border [&_td]:border-petrikline [&_td]:px-3 [&_td]:py-2";

type Group = { list: "bulleted-list" | "numbered-list"; blocks: RichTextBlock[] } | { list: null; block: RichTextBlock };

/** Az egymás utáni listaelem-blokkok egy <ul>/<ol>-ba kerülnek. */
function groupBlocks(document: RichTextDocument): Group[] {
  const groups: Group[] = [];
  for (const block of document) {
    if (block.type === "bulleted-list" || block.type === "numbered-list") {
      const last = groups[groups.length - 1];
      if (last && last.list === block.type) {
        last.blocks.push(block);
        continue;
      }
      groups.push({ list: block.type, blocks: [block] });
      continue;
    }
    groups.push({ list: null, block });
  }
  return groups;
}

/** Szövegen belüli `\n` sortörés. */
function withBreaks(text: string): ReactNode {
  if (!text.includes("\n")) return text;
  return text.split("\n").map((line, index) => (
    <Fragment key={index}>
      {index > 0 && <br />}
      {line}
    </Fragment>
  ));
}

/** Belső útvonal: routerlink; fájl/levél/telefon: sima <a>; minden más: új lapon. */
function linkTo(href: string | undefined, children: ReactNode): ReactNode {
  if (!href || !isSafeHref(href)) return children;
  if (isFileHref(href)) return <a href={href}>{children}</a>;
  if (href.startsWith("/")) return <Link to={href}>{children}</Link>;
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function renderRuns(runs: TextRun[]) {
  return runs.map((run, index) => {
    let node: ReactNode = withBreaks(run.text);
    if (run.color) node = <span style={{ color: run.color }}>{node}</span>;
    if (run.underline) node = <u>{node}</u>;
    if (run.italic) node = <em>{node}</em>;
    if (run.bold) node = <strong>{node}</strong>;
    return <Fragment key={index}>{linkTo(run.href, node)}</Fragment>;
  });
}

/** Feltöltés (/…) vagy http(s) cím - a szerver mást nem tárol, ez csak újra ellenőrzi. */
const isImageSrc = (src: string) => (src.startsWith("/") && !src.startsWith("//")) || /^https?:\/\//i.test(src);

/** A régi oldalról átvett hírek média blokkjai: kép, galéria, beágyazás. */
export function MediaBlock({ block }: { block: RichTextBlock }) {
  if (block.type === "image" && block.image && isImageSrc(block.image.src)) {
    const { src, alt, caption, href, width, height } = block.image;
    const align = block.align === "center" ? "text-center" : block.align === "right" ? "text-right" : "";
    return (
      <figure className={`mb-6 ${align}`}>
        {linkTo(href, <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" className="inline-block h-auto max-w-full rounded-md" />)}
        {caption && <figcaption className="mt-2 text-sm text-petriksoft">{caption}</figcaption>}
      </figure>
    );
  }
  if (block.type === "gallery" && block.gallery?.length) {
    return (
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {block.gallery
          .filter((item) => isImageSrc(item.src))
          .map((item, at) => {
            const img = <img src={item.src} alt={item.alt} loading="lazy" decoding="async" className="aspect-[400/284] w-full rounded-md object-cover" />;
            return item.full && isImageSrc(item.full) ? (
              <a key={at} href={item.full} target="_blank" rel="noreferrer">
                {img}
              </a>
            ) : (
              <div key={at}>{img}</div>
            );
          })}
      </div>
    );
  }
  if (block.type === "embed" && block.embed && isEmbedSrc(block.embed.src)) {
    const { src, title, aspect, height } = block.embed;
    const frame = (
      <iframe
        src={src}
        title={title ?? "Beágyazott tartalom"}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className={`block w-full border-0 ${aspect ? "absolute inset-0 h-full" : ""}`}
        style={aspect ? undefined : { height: height ?? 500 }}
      />
    );
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
    );
  }
  return null;
}

function renderGroup(group: Group) {
  if (group.list) {
    const Tag = group.list === "bulleted-list" ? "ul" : "ol";
    return (
      <Tag key={group.blocks[0].id}>
        {group.blocks.map((block) => (
          <li key={block.id}>{renderRuns(block.runs)}</li>
        ))}
      </Tag>
    );
  }

  const { block } = group;
  if (block.type === "image" || block.type === "gallery" || block.type === "embed") return <MediaBlock key={block.id} block={block} />;
  if (block.type === "table" && block.table) {
    const [first, ...rest] = block.table.rows;
    const head = block.table.header && first ? first : null;
    const body = head ? rest : block.table.rows;
    return (
      <div key={block.id} className="overflow-x-auto">
        <table>
          {head && (
            <thead>
              <tr>
                {head.map((cell, at) => (
                  <th key={at}>{cell}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {body.map((row, rowAt) => (
              <tr key={rowAt}>
                {row.map((cell, at) => (
                  <td key={at}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const style = block.align && block.align !== "left" ? { textAlign: block.align } : undefined;

  if (block.type === "heading") {
    const Heading = `h${block.level ?? 2}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    return (
      <Heading key={block.id} style={style}>
        {renderRuns(block.runs)}
      </Heading>
    );
  }
  if (block.type === "blockquote") {
    return (
      <blockquote key={block.id} style={style}>
        {renderRuns(block.runs)}
      </blockquote>
    );
  }
  return (
    <p key={block.id} style={style}>
      {renderRuns(block.runs)}
    </p>
  );
}

/** A Szerkesztő tartalomfája (RichContent): elem elemnek, nyers HTML nélkül. */
function renderNode(node: RichNode, key: number): ReactNode {
  if (typeof node === "string") return node;
  const style: CSSProperties = {};
  for (const name of RICH_STYLE_KEYS) {
    const value = node.style?.[name];
    if (value && isValidStyleValue(name, value)) (style as Record<string, string>)[name] = value;
  }
  const children = node.children?.map(renderNode);
  const props = { key, style: Object.keys(style).length ? style : undefined };
  switch (node.tag) {
    case "br":
      return <br key={key} />;
    case "a":
      return <Fragment key={key}>{linkTo(node.href, children)}</Fragment>;
    case "p":
      return <p {...props}>{children}</p>;
    case "h1":
      return <h1 {...props}>{children}</h1>;
    case "h2":
      return <h2 {...props}>{children}</h2>;
    case "h3":
      return <h3 {...props}>{children}</h3>;
    case "h4":
      return <h4 {...props}>{children}</h4>;
    case "h5":
      return <h5 {...props}>{children}</h5>;
    case "h6":
      return <h6 {...props}>{children}</h6>;
    case "blockquote":
      return <blockquote {...props}>{children}</blockquote>;
    case "div":
      return <div {...props}>{children}</div>;
    case "ul":
      return <ul {...props}>{children}</ul>;
    case "ol":
      return <ol {...props}>{children}</ol>;
    case "li":
      return <li {...props}>{children}</li>;
    case "strong":
      return <strong {...props}>{children}</strong>;
    case "em":
      return <em {...props}>{children}</em>;
    case "u":
      return <u {...props}>{children}</u>;
    default:
      return <span {...props}>{children}</span>;
  }
}

/**
 * Csak olvasható megjelenítő. Elfogad hírblokkokat (RichTextDocument - a Hírkezelő
 * és a régi oldalról átvett hírek formátuma) és Szerkesztő-tartalomfát is
 * (RichContent). Mindig valódi JSX, dangerouslySetInnerHTML nélkül.
 */
export default function RichContent({ content, className }: { content: unknown; className?: string }) {
  const body = isLegacyBlocks(content)
    ? groupBlocks(content).map((group) => renderGroup(group))
    : toRichContent(content).map(renderNode);
  return <div className={`${proseCls} ${className ?? ""}`}>{body}</div>;
}
