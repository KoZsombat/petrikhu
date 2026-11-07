# AGENTS.md

Conventions for working on this repository. Setup, scripts and deployment are in README.md.

- **Language:** everything a visitor or editor sees is Hungarian (English only on the English pages). Code,
  comments, logs and test names are English.
- **Layout:** `apps/client` (Next.js public site), `apps/admin` (React admin), `apps/server` (Hono API),
  `packages/shared` (schemas, roles, workflow, TipTap, i18n, theme). Shared code goes in `packages/shared`.
- **Validation:** every request body, block type and document is a zod schema in `packages/shared`. The server
  validates with it, the admin's types and forms come from it. Add a field there first.
- **Blocks:** a page is `{ id, type, props }[]`. A new block type: schema + label in `packages/shared/src/blocks.ts`
  (fields get `.meta({ title, widget })`), renderer in `apps/client/components/blocks/` and in `PageRenderer`.
  The admin form appears by itself.
- **Rich text** is TipTap JSON only (`packages/shared/src/tiptap.ts` validates, `tiptap-extensions.ts` configures the
  editor, `apps/client/components/RichContent.tsx` renders). Never `dangerouslySetInnerHTML`.
- **Permissions:** code checks capabilities (`can(user, 'news.review')`); the role → capability map in
  `packages/shared/src/roles.ts` is the only place that decides who holds what.
- **Public responses** are built only from the `toPublic*` functions in `apps/server/src/lib/documents.ts`, which
  list every field. Never return a database row to the public API.
- **Audit:** every admin action that changes content or rights calls `logAudit`.
- **Schema changes:** edit `apps/server/src/db/schema.ts`, run `bun run db:generate`, commit the migration. Never edit
  a migration that has run.
- **Styling:** Tailwind 4 with the tokens in `packages/shared/src/theme.css`; no new colours or fonts. The public
  site must keep its look; check pages against a screenshot when touching markup.
- **Client JS:** public pages are server components; add `'use client'` only for real interaction.
- **Routes:** a new fixed top-level route on the site must be added to `RESERVED_SLUGS` (a test checks it).
- **UI strings** of the public site are keys in `packages/shared/src/i18n/{hu,en}.json` (both files, same keys).
- **Single instance:** the scheduled-post sweep and the rate limiters live in the API process; do not run two.
- **Done means:** `bun run lint`, `bun run typecheck`, `bun run build`, `bun run test` and `bun run e2e` pass; every
  bug fix has a regression test; README.md and this file still describe the code.
