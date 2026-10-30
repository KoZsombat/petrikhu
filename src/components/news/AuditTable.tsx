import type { AuditEntry } from "../../../shared/pnw/types";
import { auditActionLabel } from "../../../shared/pnw/statuses";
import type { ApiUser } from "../../lib/api";
import { formatDateTime } from "./helpers";
import { emptyCls, td, tdNowrap, th } from "./ui";

type Props = {
  entries: AuditEntry[];
  authors: Map<string, ApiUser>;
  /** postId → cím. */
  postTitles: Map<string, string>;
};

/** A teljes napló táblázata: mikor, ki, mi történt, melyik híren, megjegyzés. */
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
            <th className={th}>Hír</th>
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
              <td className={`${td} max-w-xs`}>{postTitles.get(entry.postId) ?? <span className="text-petrikfaint">#{entry.postId}</span>}</td>
              <td className={`${td} max-w-sm whitespace-pre-line text-petriksoft`}>{entry.note || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
