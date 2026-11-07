/**
 * Roles and capabilities. Code always checks a capability (`can(user, 'news.review')`); the role → capability
 * map below is the only place that decides who holds what.
 */
export const CAPABILITIES = [
  'news.write', // write own posts, save drafts, submit for review
  'news.review', // review queue: edit a post in review, approve, schedule, reject
  'news.manage', // edit, archive and restore published posts
  'terms.create', // create categories and tags (using existing ones needs nothing)
  'pages.manage', // Creator: pages and menus
  'library.manage', // document library
  'media.upload', // upload images to the media library
  'audit.view', // audit log and statistics
  'users.manage', // accounts and roles
  'users.directory', // the staff name directory (authors' names in lists and the log)
] as const

export type Capability = (typeof CAPABILITIES)[number]

export const ROLES = ['inactive', 'author', 'reviewer', 'editor', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  inactive: [],
  author: ['news.write', 'media.upload', 'users.directory'],
  reviewer: ['news.write', 'news.review', 'news.manage', 'terms.create', 'media.upload', 'audit.view', 'users.directory'],
  editor: ['pages.manage', 'library.manage', 'media.upload', 'users.directory'],
  admin: CAPABILITIES,
}

export const ROLE_LABEL: Record<Role, string> = {
  inactive: 'Nincs jogosultság',
  author: 'Szerző',
  reviewer: 'Jóváhagyó',
  editor: 'Oldalszerkesztő',
  admin: 'Adminisztrátor',
}

export const ROLE_DESCRIPTION: Record<Role, string> = {
  inactive: 'Be tud lépni, de semmihez nem fér hozzá.',
  author: 'Saját hírt írhat, piszkozatként mentheti és jóváhagyásra küldheti.',
  reviewer: 'Hírt ír, jóváhagy, időzít, visszaküld, a kint lévő híreket kezeli; látja a naplót és a statisztikát.',
  editor: 'Oldalakat, menüt és a dokumentumtárat szerkeszti.',
  admin: 'Mindenhez hozzáfér, a fiókokat is kezeli.',
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function capabilitiesOf(role: string | null | undefined): readonly Capability[] {
  return isRole(role) ? ROLE_CAPABILITIES[role] : []
}

export function can(user: { role: string } | null | undefined, capability: Capability): boolean {
  return !!user && capabilitiesOf(user.role).includes(capability)
}

/**
 * The smallest role that holds every capability in `wanted` (in the order of ROLES); `admin` when none smaller does.
 * Used by the legacy migration to turn the old per-account permission lists into one role.
 */
export function smallestRoleCovering(wanted: readonly Capability[]): Role {
  for (const role of ROLES) {
    const held = ROLE_CAPABILITIES[role]
    if (wanted.every((capability) => held.includes(capability))) return role
  }
  return 'admin'
}
