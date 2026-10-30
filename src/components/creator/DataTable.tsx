import type { ReactNode } from "react";
import { Container } from "./Container";
import { cx } from "./utils";

export type DataTableProps = {
  heading?: string;
  /** Column headers. */
  columns: string[];
  /** Rows; a line break (\n) in a cell starts a new line. */
  rows: { cells: string[] }[];
  /** First column highlighted (e.g. code number, name). */
  highlightFirst?: boolean;
  footnote?: string;
  className?: string;
  limit?: number;
};

/** In cell text, `[label](https://address)` becomes a link; everything else is plain text. */
function renderCell(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const link = /\[([^\]]+)\]\(((?:https?:\/\/|\/|mailto:)[^)\s]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(link)) {
    parts.push(text.slice(last, m.index));
    const external = m[2].startsWith("http");
    parts.push(
      <a key={m.index} href={m[2]} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="text-petrikaccentdark underline underline-offset-2 hover:text-petrikaccent">
        {m[1]}
      </a>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

/** Table: a grid on large screens, cards per row on mobile (the column header above each cell). */
export function DataTable({ heading, columns, rows, highlightFirst = true, footnote, className, limit }: DataTableProps) {
  const shown = limit === undefined ? rows : rows.slice(0, limit);
  return (
    <section data-component="DataTable" className={cx("py-12 md:py-16", className)}>
      <Container>
        {heading && <h2 className="mb-6 font-display text-2xl font-bold text-balance">{heading}</h2>}
        <div className="overflow-hidden rounded-xl border border-petrikline bg-petrikcard">
          <table className="block w-full border-collapse text-[15px] md:table">
            <thead className="hidden md:table-header-group">
              <tr className="bg-petriktint text-left">
                {columns.map((column, i) => (
                  <th key={i} className="px-5 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-petrikaccentdark">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {shown.map((row, r) => (
                <tr key={r} className="block border-t border-petriklinesoft first:border-t-0 md:table-row md:odd:bg-transparent md:even:bg-petrikcream/60">
                  {columns.map((column, c) => (
                    <td
                      key={c}
                      data-label={column}
                      className={cx(
                        "block whitespace-pre-line px-5 py-2 align-top leading-snug before:mb-0.5 before:block before:font-mono before:text-[10px] before:uppercase before:tracking-[0.15em] before:text-petrikfaint before:content-[attr(data-label)] md:table-cell md:py-4 md:before:hidden",
                        c === 0 && highlightFirst && "font-semibold text-petrikaccentdark",
                      )}
                    >
                      {renderCell(row.cells[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {footnote && <p className="mt-3 text-sm text-petriksoft">{footnote}</p>}
      </Container>
    </section>
  );
}
