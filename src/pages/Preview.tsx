import { PageRenderer, PageTemplate } from "../components";
import type { PageBlock } from "../components";

export const PREVIEW_KEY = "page-creator:preview";

function load(): PageBlock[] {
  try {
    return JSON.parse(localStorage.getItem(PREVIEW_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function Preview() {
  const content = load();
  if (content.length === 0) return <p className="p-6">Nincs megjeleníthető oldal.</p>;
  return (
    <PageTemplate>
      <PageRenderer content={content} />
    </PageTemplate>
  );
}
