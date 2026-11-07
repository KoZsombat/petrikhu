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

The API refuses to start in production without a real session secret, or while an account still has a public demo
password and `PNW_SEED_PASSWORD` is not set (with it, demo passwords are replaced on start).

## Backups

`backup` writes a daily `pg_dump -Fc` to `PNW_BACKUP_DIR` (default `./backups`) and keeps `PNW_BACKUP_KEEP_DAYS`
(14) days. Media is in the database, so one dump is the whole site. Copy the dumps off the host. Restore into an
empty database:

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
It is idempotent and prints a report. The full production procedure (backup, scratch run, checks, switch-over,
rollback) is in `PR_DESCRIPTION.md`; the mappings:

| Old post status | New |
|---|---|
| `draft` | `draft` |
| `pending` | `in_review` |
| `pnw_revision` (sent back) | `draft`, with the review message kept |
| `pnw_test_ok` (test-mode approval) | `in_review` (test mode is gone; a reviewer decides again) |
| `publish` / `future` / `pnw_archived` / `trash` | `published` / `scheduled` / `archived` / `trash` |

Old per-account permissions become the smallest role that holds all of them (`smallestRoleCovering` in
`packages/shared/src/roles.ts`); no permission → `inactive`. Imported passwords (bcrypt) keep working and are
re-hashed with argon2id at the next login. Sessions are not copied: everyone logs in again.

## Roles

| Role | Capabilities |
|---|---|
| Szerző (`author`) | write own news, upload images |
| Jóváhagyó (`reviewer`) | + review, approve / schedule / reject, manage published news, create categories, log and statistics |
| Oldalszerkesztő (`editor`) | pages, menus, document library, media |
| Adminisztrátor (`admin`) | everything, including accounts |
| `inactive` | can log in, nothing else |
