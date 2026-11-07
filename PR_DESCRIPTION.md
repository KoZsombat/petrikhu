# Rewrite as a monorepo: Next.js site, React admin, Hono API, shared zod schemas

## Summary

The repository is rewritten as a Bun + Turborepo monorepo:

```
apps/client   Next.js (App Router) public site, rendered on the server; the only exposed port
apps/admin    React + Vite admin at /admin (news, review, Creator, media, library, accounts, log, statistics)
apps/server   Hono API on Bun, PostgreSQL via Drizzle, Better Auth sessions, media in the database
packages/shared  zod schemas, roles → capabilities, workflow, TipTap schema + editor config, i18n, theme
```

The public site looks the same: the compared pages are the same height as before to the pixel, and less than
1% of pixels differ on most pages (anti-aliasing and the re-encoded logo). The difference is in how it is built: every page
is server-rendered from the database (no content flash, no page content in any bundle), rich text is TipTap JSON
rendered to JSX, and the homepage ships about 44% less JavaScript.

## What changed

**Data (PostgreSQL + Drizzle).** Schema in `apps/server/src/db/schema.ts`, generated migrations in
`apps/server/drizzle/`. Pages and news posts share one `documents` table (`type`, `slug`, `locale`, `title`,
`description`, `blocks` jsonb, `status`, timestamps, author; posts add the workflow columns). Terms are a table with
a parent (category hierarchy) and a `document_terms` join table. `settings` holds the per-locale menus and the
document library. `audit_log` is one generic table (who, what, which entity, note, time). Media stays in Postgres
(`media`, `STORAGE EXTERNAL`) so one `pg_dump` is a full backup; range requests, ETags, long caching for uploads
and the sandbox CSP for unsafe types are kept. Foreign keys everywhere (`ON DELETE SET NULL` for users), jsonb and
timestamptz, indexes for the list queries.

**Images.** Uploads are processed with sharp: WebP and AVIF in 480 / 960 / 1600 px (never wider than the
original). The site requests them through `<picture>` + `srcset`; files from the old site get their variant on
first request, then it is stored. The 2.5 MB hero PNG is now AVIF / WebP / JPEG in three widths (46 KB AVIF at
1280 px), the 175 KB logo a 6 KB palette PNG; partner logos have WebP copies.

**Content model.** TipTap JSON is the only rich-text format. The blocks-and-runs format, its hand-written editor
and renderer, and the sanitized-HTML path (`sanitize-html`, `dangerouslySetInnerHTML`) are gone. The Creator's
blocks are defined by zod schemas in `packages/shared/src/blocks.ts`; the admin generates the forms from them.
Merged blocks: `CardGrid` text/person/stat → `cards`; `RowList` fact/step → `rows`; `RowList`/`CardGrid` news →
`newsList` (live, filterable and paged, or hand-picked rows); `CardGrid` highlight + `Callout` → `callout`
(tone `info` / `accent` / `highlight`); the document library is a block (`documentLibrary`), so `/dokumentumtar`
is an editable page. The built-in pages (`pages.json`, `pages.en.json`, `pageTitles.json`, `dokumentumtar.json`)
are seed data in `apps/server/seed/`, converted and written into the database once.

**News workflow.** draft → in_review → scheduled / published → archived; trash with restore (as a draft). A
reviewer approves now, schedules, or rejects with a message; the post returns to its author as a draft showing
the message, and the message is cleared on resubmission. Scheduled posts are published by a sweep every minute.
Test mode (`PNW_TEST_MODE`, "approved in test") is removed. Review notes and other internal fields never reach
the public API.

**Auth and permissions.** Better Auth (username plugin, Drizzle adapter, sessions in Postgres) behind our own
routes: its HTTP handler is not mounted, so sign-up and e-mail flows are unreachable. Roles (`author`,
`reviewer`, `editor`, `admin`, plus `inactive`) map to capabilities in `packages/shared/src/roles.ts`; code only
checks capabilities. Users change their own password, which ends their other sessions; an admin setting a
password ends all of that user's sessions. Kept: a new session on login, httpOnly / SameSite=Lax / Secure (behind
HTTPS) cookies, the same-origin check, the in-memory rate limits, and refusing to start in production with a
default secret or demo passwords.

**Security fixes.**
1. Public DTOs: `toPublic*` in `apps/server/src/lib/documents.ts` list every public field; a test checks the exact
   key sets and that no internal value (review note, ids, status) appears (`test/api/public.test.ts`).
2. Login: argon2id via Bun's native, asynchronous `Bun.password` with one fixed cost; Better Auth hashes the
   password with the same function when the username does not exist (a timing test checks the ratio); the lockout
   is keyed on account + IP, so a stranger cannot lock someone out (plus 30 attempts per IP).
3. A password change ends the other sessions (tests for self-service and admin changes).
4. Route-scoped body limits (`apps/server/src/lib/limits.ts`): 100 KB by default, 8 MB only on page / post save
   and preview, 10 MB on uploads (with the 8 / 9 MB per-file checks).
- No `/components-preview` route; the public bundle contains no admin code (separate app).
- The CSP drops the Google Fonts hosts (fonts are self-hosted) and uses a per-request nonce on the public site.

**Public site (Next.js).** Server components everywhere; client components only for the mobile menu, the
language switch, the document library search, the molecule canvas and the count-up numbers. Archivo,
Newsreader and IBM Plex Mono via `next/font/local`. Metadata and Open Graph through the metadata API (replaces
`server/lib/page-meta.ts`). Old news URLs `/<slug>` → 301 → `/hirek/<slug>`; `/about-us` → 301 → `/en/about-us`.
Search, the document library, the news list (`?kategoria=`, `?oldal=`) and single news pages work as before.

**Languages.** UI strings by key in `packages/shared/src/i18n/{hu,en}.json`. Documents carry a locale: English
exists for the home page (`/en`), about (`/en/about-us`), admissions (`/en/admissions`) and contact
(`/en/contact`); the language switch links a page to its translation.

**Admin.** Dashboard, news editor (TipTap), review queue, published / archived lists, trash, Creator (pages in
both languages, per-language menus), media library, document library, accounts and roles, audit log with
filters, statistics, own account. Each post shows its history. Previews go through `/api/preview` and open on the
public site at `/elonezet/<id>`, only for their author.

**Removed:** `src/`, `server/`, `shared/`, `tests/`, `server/media-seed/` (24 MB; `bun run media:import` loads such
a folder), the WordPress/Divi-era code (`legacy-overrides.ts`, `seed-categories.ts`, `mirror-routes.ts`,
`page-doc.ts`, `page-types.ts`, `rich-content.ts`, the "Ported from PNW_…" comments), `react-icons`, the no-op
e-mail notification stubs, and the `hidden-mirror` endpoint.

## Numbers

| | Before | After |
|---|---|---|
| Homepage JavaScript (modern browsers) | 858 KB (254 KB gzip), one bundle | 480 KB (144 KB gzip); our own code ≈ 35 KB of it, the rest is the React + Next.js runtime |
| Homepage hero image | 2.5 MB PNG | 19–59 KB AVIF / 30–83 KB WebP, by screen width |
| Logo | 175 KB PNG | 6 KB / 14 KB PNG (1x / 2x) |
| Tests | 206 (node:test) | 108 API tests (`bun test`) + 6 Playwright smoke tests |

(The Next.js build also emits a 112 KB `noModule` polyfill chunk that only very old browsers download; it is not
counted above. Measured with `next start` on this branch and `vite build` on `main`.)

## How to run

```bash
docker compose -f docker-compose.dev.yml up
```

Site on http://localhost:4000, admin on http://localhost:5173/admin/, API on http://localhost:4001; demo accounts
in README.md. Without Docker: Bun 1.4, Node 24, PostgreSQL 17, then `bun install` and `bun run dev`.

Checks: `bun run lint`, `bun run typecheck`, `bun run build`, `bun run test`, `bun run e2e` (CI runs all of them,
with Postgres 17).

Production stays manual: `git pull`, `docker compose run --rm backup once`, `docker compose up -d --build`.
The compose file now has `api` (internal) and `web` (`127.0.0.1:4000`) instead of the single `petrik` service.

## Migrating production data

`bun run migrate:legacy` reads the old database (`LEGACY_DATABASE_URL`) and writes a **new, separate** database
(`DATABASE_URL`). It never writes to the old one. It is idempotent (upserts by id or path), prints a report (each
account's old permissions → new role, renamed pages, conversion issues) and copies the media one file at a time.

Mappings:

| Old post status | New |
|---|---|
| `draft` | `draft` |
| `pending` | `in_review` |
| `pnw_revision` | `draft`, review message kept (shown to the author) |
| `pnw_test_ok` | `in_review` (test mode is gone; a reviewer decides again) |
| `publish` | `published` |
| `future` | `scheduled` |
| `pnw_archived` | `archived` |
| `trash` | `trash` |

| Old permissions (any combination) | New role |
|---|---|
| none | `inactive` |
| only `pnw_submit_news` | `author` |
| a subset of submit / review / manage published / audit log / manage terms | `reviewer` |
| only `pnw_manage_pages` and/or `pnw_manage_library` | `editor` |
| anything with `pnw_manage_users`, or pages/library together with news rights | `admin` |

The rule is "the smallest role that holds every old permission", so nobody loses access; the report lists who
gains capabilities (e.g. `pnw_submit_news` + `pnw_manage_terms` becomes `reviewer`). Check it, and adjust roles on
the Fiókok screen afterwards.

Other conversions: post content (blocks and runs) and the HTML fields of Creator pages become TipTap JSON; old
page blocks become the new block types; category parents come from the old archive routes; old non-uuid ids get
stable uuids; a page that is a draft or in the trash and has a built-in page's slug (or a now-reserved slug) is
renamed to `<slug>-regi`, so it does not hide the built-in page; the built-in pages, menus and library are seeded
where the old data did not provide them. Sessions are not copied.

Steps (all on the server, in the repository folder):

1. **Back up the old database** (the old app is still running) and copy the dump off the host:
   ```bash
   docker compose run --rm backup once
   ```
2. **Pull and build** the new version without starting it:
   ```bash
   git pull && docker compose build
   ```
   Then check `.env`: `PNW_SESSION_SECRET` must now be at least 32 characters. If the tunnel's Public Hostname
   was `http://petrik:4000`, change it to `http://web:4000` (`http://localhost:4000` stays valid).
3. **Rehearse on a scratch copy.** Restore the dump into a scratch database and migrate it into another one:
   ```bash
   set -a; . ./.env; set +a
   docker compose up -d postgres
   docker compose exec -T postgres createdb -U petrik petrik_scratch_old
   docker compose exec -T postgres pg_restore -U petrik -d petrik_scratch_old --no-owner < backups/<the dump>
   docker compose exec -T postgres createdb -U petrik petrik_scratch_new
   docker compose run --rm -e LEGACY_DATABASE_URL=postgres://petrik:$POSTGRES_PASSWORD@postgres:5432/petrik_scratch_old -e DATABASE_URL=postgres://petrik:$POSTGRES_PASSWORD@postgres:5432/petrik_scratch_new api bun run --cwd apps/server migrate:legacy
   ```
   (The first line loads `$POSTGRES_PASSWORD` from `.env` into the shell.)
4. **Verify the scratch result.** Read the report (roles, renamed pages, issues). Compare counts:
   ```bash
   docker compose exec -T postgres psql -U petrik -d petrik_scratch_old -c "select status, count(*) from posts group by 1"
   docker compose exec -T postgres psql -U petrik -d petrik_scratch_new -c "select status, count(*) from documents where type='post' group by 1"
   ```
   Then run the new stack on it and click through (news list, a few old posts, pages, the library, the admin with
   an old account, which needs the old password):
   ```bash
   PNW_DB_NAME=petrik_scratch_new docker compose up -d api web
   ```
   Stop it afterwards: `docker compose stop api web`.
5. **Switch production.** Stop the old app and the backup service so nothing writes, take a final backup, migrate
   into a new database and swap the names:
   ```bash
   docker stop $(docker ps -q --filter name=petrik-1) ; docker compose stop backup
   docker compose run --rm backup once
   docker compose exec -T postgres createdb -U petrik petrik_new
   docker compose run --rm -e LEGACY_DATABASE_URL=postgres://petrik:$POSTGRES_PASSWORD@postgres:5432/petrik -e DATABASE_URL=postgres://petrik:$POSTGRES_PASSWORD@postgres:5432/petrik_new api bun run --cwd apps/server migrate:legacy
   docker compose exec -T postgres psql -U petrik -d postgres -c "ALTER DATABASE petrik RENAME TO petrik_old" -c "ALTER DATABASE petrik_new RENAME TO petrik"
   docker compose up -d --remove-orphans
   ```
   (The first command stops the old `petrik` container, which the new compose file no longer defines.)
6. **Check the live site**, log in, and fix roles on the Fiókok screen if the report showed any surprises.

**Rollback:** `docker compose down`, rename the databases back (`petrik` → `petrik_new`, `petrik_old` → `petrik`),
`git checkout` the previous commit and `docker compose up -d --build`. The old database is never modified by the
migration, so nothing is lost. Drop `petrik_old` and the scratch databases once the new site has run for a while.

The migration was tested against `apps/server/test/fixtures/legacy-v5.sql`: a database created by the old app at
schema version 5, filled through the old API (posts in every status, including a test-mode approval and an
imported post with image, gallery and embed blocks; Creator pages, one overriding a built-in page and one in the
trash; an edited menu and library; accounts with different permission sets; terms, audit entries, sessions and
media). The test checks that everything arrives, the mappings, a second run that changes nothing, and that the new
app logs in with the old passwords and serves the migrated content. The CLI was also run against that database
directly.

## Deviations

- **Facebook / Instagram icons** are small inline SVGs: lucide-react has no brand icons, and `react-icons` had to go.
- **Body font:** the old site never applied Archivo to body text (Tailwind's default sans stack was used), only to
  elements with `font-body`. That is kept as is, to keep the look identical.
- **Homepage JavaScript** is about 44% smaller (480 KB vs 858 KB raw, 144 KB vs 254 KB gzip), not "far" smaller:
  the floor is the React + Next.js App Router runtime (≈ 445 KB). The site's own client code is about 35 KB.
- **English pages:** only the four key pages are English (home, about, admissions, contact). The English versions of
  the other 21 built-in pages in the old `pages.en.json` were not migrated; the English menu links to the Hungarian
  pages for those.
- **`/about-us`** redirects (301) to `/en/about-us` instead of being served at the old path.
- **Old news URLs** `/<slug>` now redirect (301) to `/hirek/<slug>` instead of rendering in place.
- **`/hir-cikk`** (a placeholder "sample article" design page) and the placeholder news rows of the `/hirek` page
  are not seeded; `/hirek` lists the real posts.
- **The rejected state** is a draft with a review note (not its own status), as the requested status list has no
  separate "rejected" state.
- **The page/post body** of a post is stored as one `richText` block in `blocks`, so both document types share the
  column.
- **Legacy bcrypt passwords** keep working and are re-hashed with argon2id at the next login. Until then, a login
  for such an account takes bcrypt time rather than argon2id time.
- **Public content is not cached by Next.js** (`no-store`): an edit shows on the next request. The public API still
  sends `Cache-Control: public, max-age=60` for browsers.
- **Admin texts** are Hungarian literals in the admin code (it is Hungarian-only). The key-based dictionaries are
  used by the public site, the only place with two languages.
- **The API address is compiled into the Next.js build** (Next.js rewrites are resolved at build time). Compose
  passes `PNW_API_URL=http://api:4001` as a build argument; local builds default to `http://localhost:4001`.

## Known gaps

- `deploy.md` (git-ignored, local only) was not in this checkout, so it is not updated. The deployment notes there
  should be adapted to the steps above: `api` and `web` services instead of `petrik`, and a 32+ character secret.
- No two-factor login (as before).
- Category and tag management is limited to creating them in the post editor (as before); there is no screen to
  rename, merge or delete terms.
- The media library lists uploads only; the old site's `/media/...` files are served and used, but not listed.
- The dev compose file was started successfully in a sandbox where the only change was trusting the sandbox's TLS
  proxy (a local override, not committed). The production compose stack was built and run the same way
  (api + web + postgres + backup, login and pages checked).
