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
 * Whether it may move the post to the trash, restore it from there or delete it permanently: the approver any of these, the author the
 * own draft / returned post, and anything already in the trash.
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
 * nothing to filter (AGENTS.md "Server" (permissions)). Creating a *new* category or tag is the
 * only taxonomy action behind a permission (pnw_manage_terms).
 */
