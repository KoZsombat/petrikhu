/**
 * Document statuses and who may do what with a post. Posts: draft → in_review → scheduled / published →
 * archived, plus trash (restore returns a draft). A rejected post is a draft again, with the reviewer's
 * message in `reviewNote` until it is resubmitted. Pages: draft / published / trash.
 */
import { can } from './roles.ts'

export const POST_STATUSES = ['draft', 'in_review', 'scheduled', 'published', 'archived', 'trash'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const PAGE_STATUSES = ['draft', 'published', 'trash'] as const
export type PageStatus = (typeof PAGE_STATUSES)[number]

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: 'Piszkozat',
  in_review: 'Jóváhagyásra vár',
  scheduled: 'Időzítve',
  published: 'Publikálva',
  archived: 'Archiválva',
  trash: 'Lomtár',
}

type User = { id: string; role: string }
type PostRef = { authorId: string | null; status: string }

/** Edit the content: the author their own draft (also a rejected one); a reviewer any post in review or draft. */
export function canEditPost(post: PostRef, user: User): boolean {
  if (can(user, 'news.review') && (post.status === 'draft' || post.status === 'in_review')) return true
  if (can(user, 'news.manage') && post.status === 'published') return true
  return can(user, 'news.write') && post.authorId === user.id && post.status === 'draft'
}

/** Move to the trash, restore, delete for good: a reviewer anything; the author their own draft or trashed post. */
export function canTrashPost(post: PostRef, user: User): boolean {
  if (can(user, 'news.review')) return true
  return can(user, 'news.write') && post.authorId === user.id && (post.status === 'draft' || post.status === 'trash')
}

/** See it in the admin: reviewers and managers everything, an author their own posts. */
export function canViewPost(post: PostRef, user: User): boolean {
  if (can(user, 'news.review') || can(user, 'news.manage')) return true
  return can(user, 'news.write') && post.authorId === user.id
}

export const AUDIT_ENTITY_TYPES = ['post', 'page', 'user', 'media', 'menu', 'library', 'term'] as const
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]

export const AUDIT_ENTITY_LABEL: Record<AuditEntityType, string> = {
  post: 'Hír',
  page: 'Oldal',
  user: 'Fiók',
  media: 'Média',
  menu: 'Menü',
  library: 'Dokumentumtár',
  term: 'Kategória / címke',
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  created_draft: 'Piszkozat létrehozva',
  updated_draft: 'Piszkozat módosítva',
  submitted: 'Jóváhagyásra beküldve',
  reviewer_edited: 'Jóváhagyó által szerkesztve',
  rejected: 'Javításra visszaküldve',
  approved: 'Jóváhagyva és publikálva',
  scheduled: 'Jóváhagyva és időzítve',
  scheduled_published: 'Időzített hír automatikusan megjelent',
  trashed: 'Lomtárba helyezve',
  published_updated: 'Publikált hír módosítva',
  published_archived: 'Archiválva',
  archived_restored: 'Visszaállítva és újrapublikálva',
  imported: 'Importálva a régi petrik.hu-ról',
  untrashed: 'Visszaállítva a lomtárból',
  deleted: 'Véglegesen törölve',
  page_created: 'Oldal létrehozva',
  page_updated: 'Oldal módosítva',
  page_trashed: 'Oldal a lomtárba került',
  page_restored: 'Oldal visszaállítva a lomtárból',
  page_deleted: 'Oldal véglegesen törölve',
  menu_updated: 'Menü módosítva',
  menu_reset: 'Menü visszaállítva az eredetire',
  library_updated: 'Dokumentumtár módosítva',
  library_reset: 'Dokumentumtár visszaállítva az eredetire',
  user_created: 'Fiók létrehozva',
  user_updated: 'Fiók módosítva',
  user_deleted: 'Fiók törölve',
  password_changed: 'Saját jelszó megváltoztatva',
  media_uploaded: 'Fájl feltöltve',
  media_deleted: 'Fájl törölve',
  term_created: 'Kategória / címke létrehozva',
}
