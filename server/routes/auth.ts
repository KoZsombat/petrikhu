import { Router } from 'express'
import bcrypt from 'bcryptjs'
import type { LoginErrorCode } from '../../shared/pnw/types.ts'
import { findUserByUsername } from '../data/users-repo.ts'
import { sessionUser } from '../middleware/auth.ts'
import { SHOW_DEMO_LOGINS } from '../config.ts'
import { RateLimiter } from '../security.ts'

const router = Router()

/** Against password guessing: 30 attempts per IP and 8 per account every 15 minutes (a successful login resets the account's counter). */
const byIp = new RateLimiter(30, 15 * 60 * 1000)
const byAccount = new RateLimiter(8, 15 * 60 * 1000)

/** Even for an unknown username a bcrypt comparison runs, so the response time does not reveal whether the account exists. */
const DUMMY_HASH = bcrypt.hashSync('nem-letezo-fiok', 12)

const MAX_FIELD = 200

function loginError(res: import('express').Response, code: LoginErrorCode): void {
  res.status(401).json({ error: code })
}

/** Ported from PNW_Frontend_Login/PNW_Actions::frontend_login(). */
router.post('/login', async (req, res) => {
  const login = typeof req.body?.login === 'string' ? req.body.login.trim().slice(0, MAX_FIELD) : ''
  const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 1000) : ''

  if (!login || !password) {
    loginError(res, 'empty_fields')
    return
  }

  const ipKey = req.ip ?? 'unknown'
  const accountKey = login.toLowerCase()
  if (!byIp.hit(ipKey) || !byAccount.hit(accountKey)) {
    res.setHeader('Retry-After', String(Math.max(byIp.retryAfterSeconds(ipKey), byAccount.retryAfterSeconds(accountKey))))
    res.status(429).json({ error: 'too_many_attempts' })
    return
  }

  const user = await findUserByUsername(login)
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !valid) {
    loginError(res, 'invalid_credentials')
    return
  }
  byAccount.reset(accountKey)

  // PNW_Roles::has_manager_role() has no counterpart: there are no roles
  // (AGENTS.md "Server" (permissions)). An account with an empty permission list can still log
  // in and is shown the "no permission" screen, exactly as the plugin's own
  // render_unauthorized() branch does.
  // New session id on login (against session fixation).
  req.session.regenerate((error) => {
    if (error) {
      res.status(500).json({ error: 'server_error' })
      return
    }
    req.session.userId = user.id
    res.json({
      user: {
        id: user.id,
        displayName: user.displayName,
        permissions: user.permissions,
      },
    })
  })
})

/** What the login card may show before anyone is logged in - see SHOW_DEMO_LOGINS. */
router.get('/config', (_req, res) => {
  res.json({ demoLogins: SHOW_DEMO_LOGINS })
})

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true })
  })
})

router.get('/me', async (req, res) => {
  const user = await sessionUser(req)
  if (!user) {
    res.status(401).json({ error: 'not_logged_in' })
    return
  }
  res.json({ user })
})

export default router
