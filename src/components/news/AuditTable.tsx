import type { AuditEntry } from "../../../shared/pnw/types";
import { auditActionLabel, auditEntityLabel } from "../../../shared/pnw/statuses";
import type { ApiUser } from "../../lib/api";
import { formatDateTime } from "./helpers";
import { emptyCls, td, tdNowrap, th } from "./ui";

type Props = {
  entries: AuditEntry[];
  authors: Map<string, ApiUser>;
  /** postId → title. */
  postTitles: Map<string, string>;
};

/** For a post: its current title (or the one at deletion); for other objects: the type and the name at the time. */
function Subject({ entry, postTitles }: { entry: AuditEntry; postTitles: Map<string, string> }) {
  if ((entry.entityType ?? "post") === "post") {
    const title = (entry.postId && postTitles.get(entry.postId)) || entry.subject;
    return title ? <>{title}</> : <span className="text-petrikfaint">{entry.postId ? `#${entry.postId}` : "(törölt hír)"}</span>;
  }
  return (
    <>
      <small className="block text-xs text-petrikfaint">{auditEntityLabel(entry.entityType)}</small>
      {entry.subject ?? ""}
    </>
  );
}

/** Full log table: when, who, what happened, to what (post, page, menu, Dokumentumtár, account), note. */
export default function AuditTable({ entries, authors, postTitles }: Props) {
  if (entries.length === 0) return <div className={emptyCls}>Nincs a szűrésnek megfelelő naplóbejegyzés.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr>
            <th className={th}>Mikor</th>
            <th className={th}>Ki</th>
            <th className={th}>Esemény</th>
            <th className={th}>Tárgy</th>
            <th className={th}>Megjegyzés</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className={tdNowrap}>{formatDateTime(entry.createdAt)}</td>
              <td className={tdNowrap}>{(entry.userId && authors.get(entry.userId)?.displayName) || "Rendszer"}</td>
              <td className={td}>
                <strong>{auditActionLabel(entry.action)}</strong>
              </td>
              <td className={`${td} max-w-xs`}>
                <Subject entry={entry} postTitles={postTitles} />
              </td>
              <td className={`${td} max-w-sm whitespace-pre-line text-petriksoft`}>{entry.note || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
