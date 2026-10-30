import { STATUS } from './types.ts'
import type { Post, SessionUser } from './types.ts'
import { canReview, canSubmit } from './permissions.ts'

/** Ported from PNW_Access::can_edit_workflow_post(). */
export function canEditWorkflowPost(post: Post, user: SessionUser): boolean {
  if (canReview(user)) return true

  return (
    canSubmit(user) &&
    post.authorId === user.id &&
    (post.status === STATUS.DRAFT || post.status === STATUS.REVISION)
  )
}

/**
 * Lomtárba teheti, onnan visszaállíthatja vagy véglegesen törölheti-e a hírt: a jóváhagyó bármelyiket, a szerző a
 * saját piszkozatát / visszaküldött hírét, és ami már a lomtárban van.
 */
export function canTrashWorkflowPost(post: Post, user: SessionUser): boolean {
  if (canReview(user)) return true
  return canSubmit(user) && post.authorId === user.id && (post.status === STATUS.DRAFT || post.status === STATUS.REVISION || post.status === STATUS.TRASH)
}

/** Ported from PNW_Access::can_view_workflow_post(). */
export function canViewWorkflowPost(post: Post, user: SessionUser): boolean {
  if (canReview(user)) return true
  return canSubmit(user) && post.authorId === user.id
}

/*
 * PNW_Access::allowed_category_ids() has no counterpart here any more: by
 * user request every account may use every category and tag, so there is
 * nothing to filter (AGENT.md 6.16). Creating a *new* category or tag is the
 * only taxonomy action behind a permission (pnw_manage_terms).
 */
