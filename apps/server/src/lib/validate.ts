import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { z } from 'zod'

/**
 * zod validation with the API's error shape: a body (or path parameter) → 422 `{ error: 'invalid_body', issues }`;
 * a query string → 400 `{ error: 'invalid_query', issues }`.
 */
export function validate<T extends z.ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues.slice(0, 20).map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
      return target === 'query' ? c.json({ error: 'invalid_query', issues }, 400) : c.json({ error: 'invalid_body', issues }, 422)
    }
  })
}
