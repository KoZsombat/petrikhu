import { STATUS } from './types.ts'
import type { PostStatus } from './types.ts'

/** Ported 1:1 from the plugin's PNW_Statuses::label(). */
const LABELS: Record<string, string> = {
  [STATUS.DRAFT]: 'Piszkozat',
  [STATUS.PENDING]: 'Jóváhagyásra vár',
  [STATUS.REVISION]: 'Javításra visszaküldve',
  [STATUS.TEST_APPROVED]: 'Tesztben jóváhagyva – nem publikus',
  [STATUS.ARCHIVED]: 'Archiválva – nem publikus',
  [STATUS.PUBLISH]: 'Publikálva',
  [STATUS.FUTURE]: 'Időzítve',
  [STATUS.TRASH]: 'Lomtár',
}

export function statusLabel(status: string): string {
  return LABELS[status] ?? status
}

/** Ported 1:1 from PNW_Statuses::css_class() - drives the .pnw-badge-* / .pnw-status-* colors. */
export function statusCssClass(status: string): string {
  if (status === STATUS.TEST_APPROVED) return 'pending'
  if (status === STATUS.ARCHIVED) return 'draft'

  const allowed: PostStatus[] = [STATUS.DRAFT, STATUS.PENDING, STATUS.REVISION, STATUS.PUBLISH, STATUS.FUTURE]
  return (allowed as string[]).includes(status) ? status : 'other'
}

const AUDIT_LABELS: Record<string, string> = {
  created_draft: 'Piszkozat létrehozva',
  updated_draft: 'Piszkozat módosítva',
  submitted: 'Jóváhagyásra beküldve',
  reviewer_edited: 'Vezető által szerkesztve',
  rejected: 'Javításra visszaküldve',
  approved: 'Jóváhagyva és publikálva',
  scheduled: 'Jóváhagyva és időzítve',
  scheduled_published: 'Időzített hír automatikusan megjelent',
  trashed: 'Lomtárba helyezve',
  published_updated: 'Publikált hír módosítva',
  published_archived: 'Archiválva',
  archived_restored: 'Visszaállítva és újrapublikálva',
  imported: 'Importálva a régi petrik.hu-ról',
}

export function auditActionLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action
}
