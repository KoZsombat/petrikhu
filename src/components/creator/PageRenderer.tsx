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

/** One element of the page JSON: which component, which variant, with which props. */
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

/** Empty form fields (empty strings) are not passed as props. */
function cleanProps(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== "" && v !== undefined),
  );
}

/** Current search parameters (e.g. ?kategoria=…) are kept; only the page number changes. */
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
    return null; // silently skipped in production
  }

  const props: Record<string, unknown> = cleanProps(block.values);
  if (block.variant) props.variant = block.variant;

  // A function generates the pagination links; the JSON only holds the numbers.
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
