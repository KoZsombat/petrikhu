/**
 * Ported from PNW_Notifications - but there is no mail transport here, so
 * each call is a no-op beyond a server-side console log. See AGENTS.md "Server":
 * nothing in the manager UI depends on the email actually arriving, so this
 * doesn't change what a user sees.
 */
import type { Post } from '../../shared/pnw/types.ts'

function log(event: string, post: Post): void {
  console.log(`[pnw:notify] ${event} — "${post.title}" (#${post.id})`)
}

export function notifySubmitted(post: Post): void {
  log('submitted', post)
}

export function notifyRejected(post: Post, note: string): void {
  log(`rejected: ${note}`, post)
}

export function notifyApproved(post: Post): void {
  log('approved', post)
}

export function notifyScheduled(post: Post, display: string): void {
  log(`scheduled for ${display}`, post)
}

export function notifyScheduledPublished(post: Post): void {
  log('scheduled_published', post)
}
