import type { AuditEntry } from "../../../shared/pnw/types";
import { auditActionLabel } from "../../../shared/pnw/statuses";
import type { ApiUser } from "../../lib/api";
import { formatDateTime } from "./helpers";
import { emptyCls } from "./ui";

type Props = {
  entries: AuditEntry[];
  authors: Map<string, ApiUser>;
  /** postId → cím; csak a teljes naplóban látszik, a hír saját naplójában nem. */
  postTitles?: Map<string, string>;
  compact?: boolean;
};

/** Naplóbejegyzések idővonala. */
export default function AuditTimeline({ entries, authors, postTitles, compact }: Props) {
  if (entries.length === 0) return <div className={emptyCls}>Még nincs naplóbejegyzés.</div>;

  return (
    <ol className="flex flex-col border-l-2 border-petrikline pl-5">
      {entries.map((entry) => (
        <li key={entry.id} className={`relative ${compact ? "pb-3" : "pb-5"}`}>
          <span className="absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-petrikbg bg-petrikaccent" />
          <strong className="block text-sm">{auditActionLabel(entry.action)}</strong>
          {!compact && postTitles && <span className="block text-sm text-petriksoft">{postTitles.get(entry.postId) ?? `#${entry.postId}`}</span>}
          <small className="font-mono text-xs text-petrikfaint">
            {(entry.userId && authors.get(entry.userId)?.displayName) || "Rendszer"} · {formatDateTime(entry.createdAt)}
          </small>
          {entry.note && <p className="mt-1 whitespace-pre-line text-sm text-petriksoft">{entry.note}</p>}
        </li>
      ))}
    </ol>
  );
}
