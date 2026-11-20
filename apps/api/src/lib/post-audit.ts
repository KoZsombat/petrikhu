import { db } from "../db";
import { postAuditLog } from "../db/schema";
import type { PostStatus } from "../types/postTypes";

/**
 * Every workflow mutation writes one audit row inside the same transaction as the post update,
 * so the trail can never disagree with the post. Action names are stable API surface.
 */
export type PostAuditAction =
  | "created"
  | "updated"
  | "submitted"
  | "reviewer_edited"
  | "rejected"
  | "approved"
  | "deleted";

/** Accepts either the pool or a transaction handle. */
type Executor = Pick<typeof db, "insert">;

export type PostAuditEntry = {
  postId: string;
  actorId: string | null;
  action: PostAuditAction;
  fromStatus?: PostStatus | null;
  toStatus?: PostStatus | null;
  note?: string | null;
};

export async function logPostEvent(
  executor: Executor,
  entry: PostAuditEntry,
): Promise<void> {
  await executor.insert(postAuditLog).values({
    postId: entry.postId,
    actorId: entry.actorId,
    action: entry.action,
    fromStatus: entry.fromStatus ?? null,
    toStatus: entry.toStatus ?? null,
    note: entry.note ?? null,
  });
}
