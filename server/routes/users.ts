/**
 * Hírkezelő account management - no equivalent in the real plugin, which
 * relies on wp-admin's own user screen. Added by user request; an account is
 * a name, a login and a **set of permissions** - there are no roles
 * (AGENTS.md "Server" (permissions)), so this is where every capability is handed out one by
 * one.
 */
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { CAPABILITY } from '../../shared/pnw/types.ts'
import type { Capability } from '../../shared/pnw/types.ts'
import { canManageUsers, isCapability } from '../../shared/pnw/permissions.ts'
import { allUsers, findUserByUsername, findUserById, insertUser, removeUser, updateUser } from '../data/users-repo.ts'
import type { UserRecord } from '../data/users-repo.ts'
import { requireCapability, requireLogin } from '../middleware/auth.ts'
import { logEvent } from '../lib/audit.ts'

const router = Router()

const MIN_PASSWORD_LENGTH = 10

function toPublic(user: UserRecord) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    permissions: user.permissions,
  }
}

function sanitizePermissions(value: unknown): Capability[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<Capability>()
  for (const entry of value) {
    if (isCapability(entry)) seen.add(entry)
  }
  return Array.from(seen)
}

/**
 * A minimal public directory (no password hashes) so the frontend can turn
 * a post's authorId / audit entry's userId into a display name, and (for
 * account managers) power the Users.tsx screen.
 */
router.get('/', requireLogin, async (req, res) => {
  // Felhasználónevet és jogosultságot csak a fiókkezelők látnak; mindenki másnak elég a név a hírek szerzőjéhez.
  const manager = canManageUsers(req.pnwUser!)
  res.json({ users: (await allUsers()).map((user) => (manager ? toPublic(user) : { id: user.id, displayName: user.displayName, permissions: [] })) })
})

router.post('/', requireCapability(CAPABILITY.MANAGE_USERS), async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : ''
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const permissions = sanitizePermissions(req.body?.permissions)

  if (!username || !displayName) {
    res.status(422).json({ error: 'missing_fields' })
    return
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(422).json({ error: 'password_too_short' })
    return
  }
  if (await findUserByUsername(username)) {
    res.status(409).json({ error: 'username_taken' })
    return
  }

  const user: UserRecord = {
    id: randomUUID(),
    username,
    displayName,
    permissions,
    passwordHash: bcrypt.hashSync(password, 10),
  }
  await insertUser(user)
  await logEvent('user', 'user_created', req.pnwUser!.id, { entityId: user.id, subject: user.username, note: permissionNote(permissions) })
  res.json({ user: toPublic(user) })
})

router.put('/:id', requireCapability(CAPABILITY.MANAGE_USERS), async (req, res) => {
  const existing = await findUserById(String(req.params.id))
  if (!existing) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : ''
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const permissions = sanitizePermissions(req.body?.permissions)

  if (!username || !displayName) {
    res.status(422).json({ error: 'missing_fields' })
    return
  }
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    res.status(422).json({ error: 'password_too_short' })
    return
  }
  const clash = await findUserByUsername(username)
  if (clash && clash.id !== existing.id) {
    res.status(409).json({ error: 'username_taken' })
    return
  }
  // Same guard as the delete below, for the other way of losing every
  // account manager: taking the permission away from the last one who has it.
  if (!permissions.includes(CAPABILITY.MANAGE_USERS) && !(await hasOtherManager(existing.id))) {
    res.status(400).json({ error: 'last_manager' })
    return
  }

  const updated = await updateUser(existing.id, (user) => ({
    ...user,
    username,
    displayName,
    permissions,
    passwordHash: password ? bcrypt.hashSync(password, 10) : user.passwordHash,
  }))
  await logEvent('user', 'user_updated', req.pnwUser!.id, { entityId: updated.id, subject: updated.username, note: changeNote(existing, updated, Boolean(password)) })
  res.json({ user: toPublic(updated) })
})

router.delete('/:id', requireCapability(CAPABILITY.MANAGE_USERS), async (req, res) => {
  if (String(req.params.id) === req.pnwUser!.id) {
    res.status(400).json({ error: 'cannot_delete_self' })
    return
  }
  const existing = await findUserById(String(req.params.id))
  if (!existing) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  if (!(await hasOtherManager(existing.id))) {
    res.status(400).json({ error: 'last_manager' })
    return
  }

  await removeUser(existing.id)
  await logEvent('user', 'user_deleted', req.pnwUser!.id, { entityId: existing.id, subject: existing.username })
  res.json({ ok: true })
})

function permissionNote(permissions: Capability[]): string {
  return permissions.length ? `Jogok: ${permissions.join(', ')}` : 'Nincs jogosultság'
}

/** Mi változott egy fiókon - a jogok változása tételesen (+ / -), a jelszó csak annyi, hogy megváltozott. */
function changeNote(before: UserRecord, after: UserRecord, passwordChanged: boolean): string | undefined {
  const parts: string[] = []
  const added = after.permissions.filter((p) => !before.permissions.includes(p))
  const removed = before.permissions.filter((p) => !after.permissions.includes(p))
  if (added.length) parts.push(`+ ${added.join(', ')}`)
  if (removed.length) parts.push(`- ${removed.join(', ')}`)
  if (before.username !== after.username) parts.push(`Felhasználónév: ${before.username} → ${after.username}`)
  if (before.displayName !== after.displayName) parts.push(`Név: ${before.displayName} → ${after.displayName}`)
  if (passwordChanged) parts.push('Jelszó megváltoztatva')
  return parts.length ? parts.join('\n') : undefined
}

/** Is there anyone *other* than this account who can still manage accounts? */
async function hasOtherManager(exceptId: string): Promise<boolean> {
  return (await allUsers()).some((user) => user.id !== exceptId && canManageUsers(user))
}

export default router
