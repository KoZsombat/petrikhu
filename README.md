# petrik.hu

The website of the Petrik Lajos Két Tanítási Nyelvű Technikum: the public site, the page editor (Creator) and
the news manager, as one monorepo.

```
apps/
  client/   Next.js (App Router): the public site, rendered on the server. The only exposed port.
  admin/    React + Vite: news, review, Creator (pages, menu), media, document library, accounts, log, statistics.
  server/   Hono on Bun: the API, the media store, the admin's static files. PostgreSQL through Drizzle.
packages/
  shared/   zod schemas (every request body, block and document), roles and capabilities, workflow,
            TipTap schema and editor config, slug and link rules, UI strings (hu.json / en.json), theme tokens.
e2e/        Playwright smoke tests.
```

One port: Next.js serves the site and proxies `/api`, `/uploads`, `/media` and `/admin` to the API.

## Quick start

With Docker, one command (Postgres, API, Next.js dev server, admin dev server):

```bash
docker compose -f docker-compose.dev.yml up
```

Site: http://localhost:4000 · Admin: http://localhost:5173/admin/ (or http://localhost:4000/admin after `bun run build`) ·
API: http://localhost:4001. An empty database gets the built-in pages and three demo accounts:
`igazgato` / `PetrikIgazgato2026!` (admin), `helyettes` / `PetrikHelyettes2026!` (reviewer),
`mk.vezeto` / `PetrikMK2026!` (author).

Without Docker you need Bun 1.4, Node 24 and PostgreSQL 17 (`postgres://petrik:petrik@localhost:5432/petrik`, or set `DATABASE_URL`):

```bash
bun install
bun run dev
```

The old site's files (`/media/...`) are not in the repository. Load a folder of them once:

```bash
bun run media:import /path/to/media-seed
```

(The former `server/media-seed` folder is in the git history: `git archive 79abeb9 server/media-seed | tar -x -C /tmp`.)

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | All apps in watch mode (Turborepo) |
| `bun run build` | Builds the admin (Vite) and the site (Next.js) |
| `bun run lint` / `bun run typecheck` | ESLint / TypeScript, every package |
| `bun run test` | API tests (`bun test`, needs Postgres: `TEST_DATABASE_URL`, default `postgres://petrik:petrik@localhost:5432/petrik_test`) |
| `bun run e2e` | Playwright smoke tests against the built apps (`bun run build` first; uses `E2E_DATABASE_URL`, recreated each run) |
| `bun run db:generate` | A new SQL migration from `apps/server/src/db/schema.ts` (drizzle-kit) |
| `bun run db:migrate` | Applies migrations and seeds an empty database (the API does this on start too) |
| `bun run media:import <dir>` | Loads a folder of files into the media table |
| `bun run migrate:legacy` | Copies the previous app's database into the new schema (see below) |

## Production

Runs with `docker compose` on one host, behind a Cloudflare Tunnel. Services: `postgres`, `api` (Bun), `web`
(Next.js on Node, `127.0.0.1:4000`), `backup`, and `cloudflared` (`--profile tunnel`; its Public Hostname is
`http://web:4000`, or `http://localhost:4000` for a tunnel on the host). Copy `.env.example` to `.env` and set at
least `POSTGRES_PASSWORD`, `PNW_SESSION_SECRET` (32+ characters), `PNW_SEED_PASSWORD` and `PNW_PUBLIC_URL`.

Deploying is manual:

```bash
git pull
```

```bash
docker compose run --rm backup once
```

```bash
docker compose up -d --build
```

On an empty production database the API creates a single admin account, `PNW_ADMIN_USERNAME` (default `admin`)
with the password `PNW_SEED_PASSWORD`, and no demo accounts. That account must choose a new password at its first
login; so must every account whose password an admin set (new accounts included) and every account whose demo
password was replaced on start. Until then the admin shows only the password-change screen and the API answers
everything except the session, logout and own-password routes with 403 `password_change_required`.

The API refuses to start in production without a real session secret, with a `PNW_SEED_PASSWORD` shorter than 10
characters, or while an account still has a public demo password and `PNW_SEED_PASSWORD` is not set (with it, demo
passwords are replaced on start).

### Client IP and rate limits

Logins, writes and searches are rate-limited per client IP. The API takes it from the header named in
`PNW_CLIENT_IP_HEADER` (compose default: `cf-connecting-ip`, set by Cloudflare and passed on by Next.js), otherwise
from the socket peer. `X-Forwarded-For` is only used with an explicit `PNW_TRUST_PROXY=<n>` (each of the n proxies
must append to it), and its left-most, visitor-supplied entry is never used on its own. If the site is not behind
Cloudflare, set `PNW_CLIENT_IP_HEADER=` (empty) or name the header your own edge proxy overwrites.

Searches (`/api/public/posts?q=`): 60 per IP per minute; the site passes the visitor's IP header on with each
search. Lists without `q` are not limited. Query strings are validated (`limit` ≤ 100, `offset` ≤ 1000, page
numbers, dates): anything else is a 400 `invalid_query`. The search column has a `pg_trgm` GIN index (the migration
creates the extension).

Logins: 8 failures per account and IP and 30 per IP per 15 minutes; on top of that, an account (existing or not)
with 10 failures from any IPs backs off exponentially (2 s, 4 s, … at most 15 minutes between attempts, forgotten
after an hour of quiet or at a successful login). Nothing is ever locked permanently.

## Backups

`backup` writes a daily `pg_dump -Fc` to `PNW_BACKUP_DIR` (default `./backups`) and keeps `PNW_BACKUP_KEEP_DAYS`
(14) days. Media is in the database, so one dump is the whole site. Login sessions and verification tokens are left
out (the tables are kept, empty), so after a restore everyone has to log in again. Copy the dumps off the host.
Restore into an empty database:

```bash
docker compose stop api web
```

```bash
docker compose exec -T postgres sh -c 'dropdb -U petrik petrik && createdb -U petrik petrik'
```

```bash
docker compose exec -T postgres pg_restore -U petrik -d petrik --no-owner < backups/petrik-YYYYMMDD-HHMMSS.dump
```

```bash
docker compose up -d
```

## Migrating from the old app

The previous app (Express + Vite, tables `creator_pages`, `posts`, `users`, …) is moved over by
`bun run migrate:legacy`, which reads `LEGACY_DATABASE_URL` and writes `DATABASE_URL` (a different, new database).
It is idempotent and prints a report (each account's old permissions and new role, renamed pages, issues). The
mappings:

| Old post status | New |
|---|---|
| `draft` | `draft` |
| `pending` | `in_review` |
| `pnw_revision` (sent back) | `draft`, with the review message kept |
| `pnw_test_ok` (test-mode approval) | `in_review` (test mode is gone; a reviewer decides again) |
| `publish` / `future` / `pnw_archived` / `trash` | `published` / `scheduled` / `archived` / `trash` |

Old per-account permissions become the smallest role that holds all of them (`smallestRoleCovering` in
`packages/shared/src/roles.ts`); no permission → `inactive`. Imported passwords (bcrypt) keep working and are
re-hashed with argon2id at the next login. Sessions are not copied: everyone logs in again. A draft or trashed
old page that has a built-in page's slug (or a now-reserved slug) is renamed to `<slug>-regi`.

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

## SEO

Pages are rendered on the server with their title, description, canonical URL, Open Graph / Twitter data and, for
translated pages, hreflang links. `/sitemap.xml` and `/robots.txt` are generated per request (`apps/client/app`);
every published page and post is in the sitemap automatically. Structured data (schema.org): the school on the
home pages, `NewsArticle` on news posts, `BreadcrumbList` on pages. Absolute URLs use `PNW_PUBLIC_URL`.

## Roles

| Role | Capabilities |
|---|---|
| Szerző (`author`) | write own news, upload images |
| Jóváhagyó (`reviewer`) | + review, approve / schedule / reject, manage published news, create categories, log and statistics |
| Oldalszerkesztő (`editor`) | pages, menus, document library, media |
| Adminisztrátor (`admin`) | everything, including accounts |
| `inactive` | can log in, nothing else (not even the staff name directory) |

Trashing or deleting a published, scheduled or archived post (also from the trash) needs `news.manage`.
