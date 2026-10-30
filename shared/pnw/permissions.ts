import { CAPABILITY } from './types.ts'
import type { Capability } from './types.ts'

/**
 * Replaces the earlier roles.ts (deleted): the real plugin's PNW_Roles maps
 * three WordPress roles onto these capabilities, but here **there are no
 * roles** - by user request every account simply carries its own set of
 * permissions (AGENT.md 6.16). Everything that used to ask "which role is
 * this?" now asks "does this account hold this capability?".
 *
 * Every helper takes the whole account-ish object rather than a role string,
 * so the same call works for a SessionUser, an Account and the frontend's
 * ApiUser alike.
 */
type HasPermissions = { permissions: Capability[] }

/** Every capability, in the order the Fiókok screen lists them in. */
export const ALL_CAPABILITIES: Capability[] = [
  CAPABILITY.SUBMIT_NEWS,
  CAPABILITY.REVIEW_NEWS,
  CAPABILITY.MANAGE_PUBLISHED,
  CAPABILITY.VIEW_AUDIT_LOG,
  CAPABILITY.MANAGE_TERMS,
  CAPABILITY.MANAGE_USERS,
  CAPABILITY.MANAGE_PAGES,
  CAPABILITY.MANAGE_LIBRARY,
]

export const CAPABILITY_LABEL: Record<Capability, string> = {
  [CAPABILITY.SUBMIT_NEWS]: 'Hír írása és beküldése',
  [CAPABILITY.REVIEW_NEWS]: 'Hírek jóváhagyása',
  [CAPABILITY.MANAGE_PUBLISHED]: 'Kint lévő hírek kezelése',
  [CAPABILITY.VIEW_AUDIT_LOG]: 'Statisztika és napló',
  [CAPABILITY.MANAGE_TERMS]: 'Kategóriák és címkék létrehozása',
  [CAPABILITY.MANAGE_USERS]: 'Fiókok kezelése',
  [CAPABILITY.MANAGE_PAGES]: 'Oldalak szerkesztése',
  [CAPABILITY.MANAGE_LIBRARY]: 'Dokumentumtár kezelése',
}

export const CAPABILITY_DESCRIPTION: Record<Capability, string> = {
  [CAPABILITY.SUBMIT_NEWS]: 'Saját hírt írhat, piszkozatként mentheti és jóváhagyásra küldheti.',
  [CAPABILITY.REVIEW_NEWS]: 'A beküldött hírt szerkesztheti, jóváhagyhatja, időzítheti vagy visszaküldheti.',
  [CAPABILITY.MANAGE_PUBLISHED]: 'A már kint lévő hírt módosíthatja, archiválhatja és visszaállíthatja.',
  [CAPABILITY.VIEW_AUDIT_LOG]: 'Megnyithatja a statisztikát és a teljes eseménynaplót.',
  [CAPABILITY.MANAGE_TERMS]: 'Új kategóriát és címkét hozhat létre. A meglévőket enélkül is bárki használhatja.',
  [CAPABILITY.MANAGE_USERS]: 'Hírkezelő-fiókokat hozhat létre, módosíthat és törölhet.',
  [CAPABILITY.MANAGE_PAGES]:
    'A Szerkesztőben módosíthatja az oldalak tartalmát, új oldalt hozhat létre vagy törölhet, és szerkesztheti a menüt.',
  [CAPABILITY.MANAGE_LIBRARY]:
    'A Szerkesztő Dokumentumtár részében dokumentumokat tölthet fel, cserélhet és törölhet, és rendezheti a kategóriákat. Az oldalakhoz ettől még nem fér hozzá.',
}

export function isCapability(value: unknown): value is Capability {
  return typeof value === 'string' && (ALL_CAPABILITIES as string[]).includes(value)
}

export function hasCapability(user: HasPermissions, capability: Capability): boolean {
  return user.permissions.includes(capability)
}

export function canSubmit(user: HasPermissions): boolean {
  return hasCapability(user, CAPABILITY.SUBMIT_NEWS)
}

export function canReview(user: HasPermissions): boolean {
  return hasCapability(user, CAPABILITY.REVIEW_NEWS)
}

export function canManagePublished(user: HasPermissions): boolean {
  return hasCapability(user, CAPABILITY.MANAGE_PUBLISHED)
}

export function canViewAuditLog(user: HasPermissions): boolean {
  return hasCapability(user, CAPABILITY.VIEW_AUDIT_LOG)
}

export function canManageUsers(user: HasPermissions): boolean {
  return hasCapability(user, CAPABILITY.MANAGE_USERS)
}

/** The Szerkesztő (/szerkeszto/) - see AGENT.md 6.19. */
export function canManagePages(user: HasPermissions): boolean {
  return hasCapability(user, CAPABILITY.MANAGE_PAGES)
}

/** The Dokumentumtár section of the Szerkesztő - see AGENT.md 6.24. */
export function canManageLibrary(user: HasPermissions): boolean {
  return hasCapability(user, CAPABILITY.MANAGE_LIBRARY)
}

/** Whether /szerkeszto/ has anything for the account: pages, the library, or both. */
export function canUseEditor(user: HasPermissions): boolean {
  return canManagePages(user) || canManageLibrary(user)
}

/**
 * Whether the account has anything to do in the Hírkezelő - any permission
 * but the Szerkesztő's two. An account holding only `pnw_manage_pages` is let
 * into /szerkeszto/, not into the news workflow (AGENT.md 6.19).
 */
export function hasNewsPermission(user: HasPermissions): boolean {
  return user.permissions.some(
    (capability) => capability !== CAPABILITY.MANAGE_PAGES && capability !== CAPABILITY.MANAGE_LIBRARY,
  )
}

export function canManageTerms(user: HasPermissions): boolean {
  return hasCapability(user, CAPABILITY.MANAGE_TERMS)
}

/**
 * What the header shows under the display name, where the role label used to
 * be. An account with nothing at all can log in but sees the "no permission"
 * screen (Unauthorized.tsx).
 */
export function permissionSummary(user: HasPermissions): string {
  if (user.permissions.length === 0) return 'Nincs jogosultság'
  return ALL_CAPABILITIES.filter((capability) => user.permissions.includes(capability))
    .map((capability) => CAPABILITY_LABEL[capability])
    .join(' · ')
}
