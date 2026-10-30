import type { SessionUser } from '../../shared/pnw/types.ts'

declare module 'express-session' {
  interface SessionData {
    userId?: string
  }
}

declare global {
  namespace Express {
    interface Request {
      pnwUser?: SessionUser
    }
  }
}

export {}
