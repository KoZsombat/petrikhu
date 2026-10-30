/**
 * Sessions live in the database (not in memory), so everyone stays logged in across restarts,
 * and expired sessions do not pile up in memory. (The `sessions` table is created by the schema in data/db.ts.)
 */
import session from 'express-session'
import { row, run } from '../data/db.ts'

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000

function expiryOf(data: session.SessionData): number {
  const expires = data.cookie?.expires
  return expires ? new Date(expires).getTime() : Date.now() + DEFAULT_TTL_MS
}

export class PgSessionStore extends session.Store {
  constructor() {
    super()
    const purge = () => run('DELETE FROM sessions WHERE expires <= $1', [Date.now()]).catch((error) => console.error('[pnw] session purge failed', error))
    void purge()
    setInterval(purge, 60 * 60 * 1000).unref()
  }

  get(sid: string, callback: (err?: unknown, session?: session.SessionData | null) => void): void {
    row<{ data: string; expires: number }>('SELECT data, expires FROM sessions WHERE sid = $1', [sid]).then(
      (found) => {
        if (!found || found.expires <= Date.now()) callback(null, null)
        else callback(null, JSON.parse(found.data) as session.SessionData)
      },
      (error) => callback(error),
    )
  }

  set(sid: string, data: session.SessionData, callback?: (err?: unknown) => void): void {
    run(
      `INSERT INTO sessions (sid, data, expires) VALUES ($1, $2, $3)
       ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires = excluded.expires`,
      [sid, JSON.stringify(data), expiryOf(data)],
    ).then(
      () => callback?.(),
      (error) => callback?.(error),
    )
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    run('DELETE FROM sessions WHERE sid = $1', [sid]).then(
      () => callback?.(),
      (error) => callback?.(error),
    )
  }

  touch(sid: string, data: session.SessionData, callback?: () => void): void {
    run('UPDATE sessions SET expires = $1 WHERE sid = $2', [expiryOf(data), sid]).then(
      () => callback?.(),
      () => callback?.(),
    )
  }
}
