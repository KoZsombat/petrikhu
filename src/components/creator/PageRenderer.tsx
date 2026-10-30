import type { ComponentType } from "react";
import {
  Accordion,
  Callout,
  CardGrid,
  CheckList,
  CtaBand,
  DataTable,
  Feature,
  Gallery,
  LinkList,
  LogoGrid,
  PageTitle,
  RichText,
  RowList,
  VideoEmbed,
} from "./index";

/** Az oldal JSON egy eleme: melyik komponens, melyik variáns, milyen propokkal. */
export type PageBlock = {
  component: string;
  variant?: string;
  values: Record<string, unknown>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry: Record<string, ComponentType<any>> = {
  PageTitle,
  CardGrid,
  RowList,
  CheckList,
  RichText,
  CtaBand,
  LogoGrid,
  Feature,
  Accordion,
  VideoEmbed,
  Callout,
  LinkList,
  Gallery,
  DataTable,
};

/** Az üres űrlapmezőket (üres string) nem adjuk át propként. */
function cleanProps(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== "" && v !== undefined),
  );
}

/** Az aktuális keresési paraméterek (pl. ?kategoria=…) megmaradnak, csak az oldalszám változik. */
function pageHref(page: number): string {
  const params = new URLSearchParams(window.location.search);
  if (page === 1) params.delete("oldal");
  else params.set("oldal", String(page));
  const query = params.toString();
  return query ? `?${query}` : window.location.pathname;
}

function Block({ block }: { block: PageBlock }) {
  const Component = registry[block.component];

  if (!Component) {
    if (import.meta.env.DEV) {
      return <div className="p-4 text-red-600">Ismeretlen blokk: {block.component}</div>;
    }
    return null; // prodban csendben kihagyjuk
  }

  const props: Record<string, unknown> = cleanProps(block.values);
  if (block.variant) props.variant = block.variant;

  // A lapozó linkjeit függvény generálja, a JSON-ban csak a számok vannak.
  const pagination = props.pagination as { current: number; total: number } | undefined;
  if (pagination) {
    props.pagination = { ...pagination, hrefFor: (p: number) => pageHref(p) };
  }

  return <Component {...props} />;
}

export function PageRenderer({ content }: { content: PageBlock[] }) {
  return (
    <>
      {content.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </>
  );
}
