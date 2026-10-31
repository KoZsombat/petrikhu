# AGENTS.md

New website for Petrik Lajos Bilingual Technical School (petrik.hu) plus a **page editor (Creator)** that lets subpages be assembled from ready-made components without coding. Language: **everything a site visitor or editor sees is Hungarian** (English only in the site's English mode, via `tr()` / `pages.en.json`). **Code is English: identifiers, comments, log messages and test names.** Older code still has Hungarian comments; translate them when you touch a file.

## Working rules (read first)

- **Update this file after every change.** If you add, remove, rename or change behaviour of a route, component, env variable, script, table, permission or deployment detail, edit the matching section here in the same piece of work. Keep it accurate rather than long; delete statements that stopped being true.
- Keep [README.md](README.md) in sync when setup, scripts or deployment change (it is the short, human-facing version of this file).
- Verify before finishing: `npm run build`, `npx tsc -p tsconfig.server.json`, `npm run lint` and `npm test` (needs a local Postgres, see "Tests").
- Every bug fix comes with a regression test.
- CI (`.github/workflows/ci.yml`) runs lint, the server type-check, the build and the tests on every push and PR; keep it green.

## Stack

React 19 + TypeScript + Vite 8, React Router 7 (`BrowserRouter`), Tailwind CSS 4 (`@theme` tokens in `src/index.css`), lucide-react / react-icons. React Compiler is on. Backend: Express 5 + PostgreSQL (`pg`) in `server/`. Built-in pages live in `pages.json`; pages saved in the editor live in the database.

```
docker compose -f docker-compose.dev.yml up   # whole dev stack: Postgres + API (node --watch) + Vite on http://localhost:5173
npm run dev       # dev server (/api, /uploads, /media are proxied to the server on port 4000)
npm run server    # the Express server (port 4000; needs DATABASE_URL, loads .env if present)
npm run db:import # one-off: copy the legacy SQLite file (server/data/db/hirkezelo.db) into Postgres
npm run build     # tsc -b && vite build
npm run lint      # eslint
npm test          # node:test, tests/**/*.test.ts (needs Postgres: TEST_DATABASE_URL)
npx tsc -p tsconfig.server.json   # type-check the server
```

## Core idea: a page is JSON

A subpage is an array of blocks, exactly in this shape (the Creator outputs the same):

```json
[
  { "component": "PageTitle", "values": { "breadcrumb": [...], "title": "...", "intro": "..." } },
  { "component": "CardGrid", "variant": "person", "values": { "columns": 3, "items": [...] } }
]
```

- `component` + optional `variant` + `values` (the component's props). `variant` is the component's `variant` prop.
- `PageRenderer` ([src/components/creator/PageRenderer.tsx](src/components/creator/PageRenderer.tsx)) picks the component from the registry by name, drops empty strings, and generates the pagination `hrefFor` itself.
- An unknown component shows a red error in dev and is silently skipped in production.

## Important files

| Location | What it is |
|---|---|
| `src/pages/samples/pages.json` | **All built-in subpages in one JSON**: `{ "<slug>": [blocks] }`, 26 pages. Routes are generated from it. |
| `src/pages/samples/elerhetoseg.json` | The first sample page (also inside `pages.json`). |
| `shared/pnw/creator-schema.ts` (re-exported by `src/pages/creatorSchema.ts`) | **The schema**: per component (and variant) field type (`text`, `textarea`, `url`, `image`, `html`, `number`, `boolean`, `select`, `list`, `object`), label, `required`. The Creator form *and* the server-side validation (`server/lib/creator-validation.ts`, zod) are built on it. |
| `src/components/creator/` | The presentational components + `PageRenderer`. Prop docs: [src/components/creator/README.md](src/components/creator/README.md). |
| `src/components/PageTemplate.tsx` | Page frame (UpperHeader + Header + Footer). Every page is wrapped in it. |
| `src/components/Landing/`, `src/pages/Landing.tsx` | The home page (Hero, News, Occupations, Reasons, Projects, Introduction, Partners). Hand-written, **not** built from JSON. |
| `src/pages/Creator.tsx`, `SchemaForm.tsx` | The editor UI; `SchemaForm` renders a form from the schema. |
| `src/pages/Dashboard.tsx` | Admin dashboard with tabs: Pages, Menu (`MenuEditor`), Media, Document library. |
| `src/lib/constants.ts` | Default menu (`menu`), top links (`upperLinks`), `labelHref` (label → route, used by the footer). |
| `src/App.tsx` | Routes. `/:slug` serves pages published from the editor (built-ins get their own routes; a published page with the same slug overrides them). |
| `src/lib/api.ts`, `useSession.ts`, `SiteContentProvider.tsx` | Fetch wrapper (relative `/api` URLs only), logged-in user, public site content (`/api/public/site`). |
| `server/`, `shared/pnw/` | Express backend and shared types (see "Server" below). `server/app.ts` builds the app (`createApp()`), `server/index.ts` boots the DB and listens. |
| `tests/` | Test suite (see "Tests"). |

## Components (14)

`PageTitle`, `CardGrid` (variants: `text`, `person`, `stat`, `news`, `highlight`), `RowList` (`fact`, `step`, `news`), `CheckList`, `RichText` (expects pre-sanitised HTML!), `CtaBand` (max. one per page, at the bottom), `LogoGrid`, `Feature`, `Accordion`, `VideoEmbed`, `Callout`, `LinkList`, `Gallery`, `DataTable` (new ones are described in the creator README).

Every root element gets `data-component` / `data-variant`. Adding a component: component in `components/creator/` → export in `index.ts` → `registry` in `PageRenderer.tsx` → schema in `creatorSchema.ts` → docs in the README.

## Routes

- `/` home (Landing)
- `/<slug>` automatically for every `pages.json` key (e.g. `/hirek`, `/vegyipar-agazat`, `/elerhetoseg`, `/about-us`)
- `/creator` editor, `/preview` last Creator preview (`localStorage` key `page-creator:preview`), `/components-preview` component catalogue, `/dashboard` (admin, login required)
- `/hirkezelo`, `/hirek/:slug`, `/kereses`, `/dokumentumtar`, `/bejelentkezes` (redirects to `/dashboard`)
- `*` 404

- `RESERVED_SLUGS` (`shared/pnw/creator-types.ts`): slugs a Creator page may not take because a fixed route (server or `App.tsx`) would hide it. Built-in `pages.json` slugs and `dokumentumtar` are *not* reserved: a published page with that slug overrides them on purpose (`BuiltInPage` / `Dokumentumtar.tsx`, Hungarian only). `tests/reserved-slugs.test.ts` fails if a new fixed route in `App.tsx` is neither.

New page: add a key to `pages.json`; the route appears automatically. To show it in the menu, add it in `constants.ts` (`href` = slug) or via the dashboard Menu tab.

## Conventions and pitfalls

- **Styling:** only `@theme` tokens (`petrikaccent`, `petrikink`, `petrikbg`, `font-display|body|mono`, ...). Do not introduce new colours or fonts.
- **The editor provides content, not looks.** Components are pure presenters.
- **`pages.json` must always match the schema.** `tests/creator-schema.test.ts` validates every page of `pages.json` and `pages.en.json` with the same zod validator the server uses on save (unknown component/variant/field, missing `required`, wrong type, invalid `select` value, unsafe link). The Creator cannot set `active` on `RowList` filters, so the JSON has none either.
- **Variant names** in JSON are the schema's (`person`, `fact`, ...), not the Hungarian design names.
- **Links:** those starting with `http` open in a new tab. Internal links are slug-based (`/nyolcadikos`). Header and Footer use `SmartLink` (`src/components/SmartLink.tsx`): internal paths become a router `Link` (no reload), the rest stay `<a>`.
- **English mode:** a built-in page without an entry in `pages.en.json` shows a "not yet available in English" notice; a `tr()` label missing from `src/i18n/en.ts` warns in dev; `tests/i18n.test.ts` lists all gaps.
- **Active menu item:** `Header.tsx` computes it from the route; if several items point to the same page (`/hirek`), only the first is active.
- `CtaBand` has no description field, only title, button, link.
- The top bar links (Kréta, Órarend, Levelezés...) and social icons are still empty `href`s.
- `dist/` is build output; do not edit.

## Origin / related

- The design is a Claude Design (artifact) canvas: 28 artboards (home, 26 subpages, "Blocks" catalogue). Subpage content was translated from it into `pages.json`.
- Home page components come from the `client/` folder of https://github.com/KoZsombat/petrikhu.

## Ideas / next steps

- `server/lib/validation.ts` (news, library, terms) is still hand-written; port it to zod like `creator-validation.ts`.
- Missing from the old site: sidebar widgets, category/date/author archives, `/docs/<slug>` document pages, Divi modules (Gallery, HeroSlider, Pricing...).
- Open Graph tags are injected by the server only; the client's `useDocumentHead` sets title/description after navigation.
- `RichText` uses `dangerouslySetInnerHTML` (forbidden on the old site); Hírkezelő content is rendered structurally through `RichContent`.

## Server

**Data:** PostgreSQL (`DATABASE_URL`; in compose the `postgres` service with the `pgdata` volume and no published port). JSON columns are `JSONB` (pg returns them parsed: repos must not `JSON.parse`), dates are `TIMESTAMPTZ` (a type parser in `db.ts` turns them back into UTC ISO strings, so the API keeps returning `toISOString()` values), `creator_pages.deleted` is `BOOLEAN`, media is `BYTEA` (migration 004). Every user reference (`author_id`, `*_by_id`, `last_reviewer_id`, `audit_log.user_id`) and `audit_log.post_id` is a foreign key with `ON DELETE SET NULL`: deleting an account keeps its posts, pages and history, and the API reports the author as `''` (the UI shows "—"). Category/tag ids are a JSONB array without FK.

**Migrations:** the schema comes from versioned migrations, run on every startup by `initDb()` (`server/data/db.ts` → `server/data/migrate.ts`). Each is a file `server/data/migrations/NNN_name.ts` exporting `up(client)`; missing ones run in order, each in its own transaction under a Postgres advisory lock, and are recorded in `schema_migrations`. `001_initial` is the old `CREATE TABLE IF NOT EXISTS` schema, so a database from before migrations just records it. **To change the schema, add a new numbered file; never edit one that has already run** (it will not run again on live databases). All repos in `server/data/*-repo.ts` are async (`row`, `rows`, `run`, `transaction` helpers from `db.ts`). Legacy data (585 news posts, 8 accounts, 37 categories/tags, 3,284 media files; ~1.2 GB) sits in the SQLite file `server/data/db/hirkezelo.db` (not in git): `npm run db:import` copies it once (`server/scripts/import-sqlite.ts`; idempotent; zone-less legacy dates count as UTC; references to missing accounts/posts are imported as NULL; covered by `tests/import-sqlite.test.ts`; sessions are not copied; `better-sqlite3` is a dev dependency used only by this script). An empty database boots with 3 demo accounts (`igazgato`, `helyettes`, `mk.vezeto`; passwords in `server/data/users-repo.ts`, overridden by `PNW_SEED_PASSWORD`). **Imported accounts keep their old passwords**: change them on the Accounts screen before going live.

Run: `npm run server` (port 4000; Vite's dev proxy points there), in production `docker compose up` (needs `POSTGRES_PASSWORD`, `PNW_SESSION_SECRET`, `PNW_SEED_PASSWORD`; see `.env.example`).

- `/dashboard` – admin (login required): pages (saved Creator pages, trash), **menu** (main-menu editor, `MenuEditor` in `Dashboard.tsx`, API `/api/pages/menu`; after saving it takes up to a minute to show publicly because `/api/public` is cached for 60 s), media, document library.
- `/creator` – page editor; `?id=` edits a saved page. Pages live in the `creator_pages` table (`blocks` = PageRenderer JSON); a published page is served at `/<slug>` and overrides a built-in page with the same slug.
- `/hirkezelo` – news manager (edit, approve, schedule, archive, statistics, log, accounts), `src/components/news/`.
- **Deleting a post works like deleting a page:** the first `DELETE /api/posts/:id` moves it to the trash (status `trash`, off the public site), `POST /api/posts/:id/untrash` restores it as a draft, and `DELETE` on a trashed post removes it for good. Authors handle their own draft/revision/trash, reviewers anything (`canTrashWorkflowPost`, `shared/pnw/access.ts`). Both dashboards show a "Lomtár" card.
- **Audit log** (`audit_log`, `server/lib/audit.ts`): news state changes (`logAudit`) plus page create/update/trash/restore/delete, menu and library update/reset, and account create/update/delete (`logEvent`; permission changes are listed as `+`/`-`, passwords never). Each entry has `entity_type` (`post|page|menu|library|user`), `entity_id` and `subject` (the name at that time, so it survives deletion). New admin actions that change content or rights must log an event.
- `PNW_TEST_MODE=true` (default off): approval marks a post `pnw_test_ok` instead of publishing it, scheduling falls back to "now", and editing/archiving published posts is refused (`production_only`). For a pilot or training copy.
- `/hirek/:slug`, `/hirek` (live news before the built-in ones, `?oldal=N`), `/kereses`, `/dokumentumtar`.
- Every upload route goes through `acceptUpload()` (`server/lib/uploads.ts`): over the limit (images 8 MB, documents 9 MB) → `413 file_too_large`, other multer errors → `400 upload_failed`.
- Media and uploads are in the database (`media_files`), served at `/uploads/*` and `/media/*`; files in `server/media-seed/` are imported on startup (idempotent). Serving reads the metadata first (ETag/304 and HEAD never touch the bytes), then streams 256 KB `substring()` slices with backpressure; single `Range` requests get 206. `media_files.data` is `STORAGE EXTERNAL` (migration 002), so a slice does not decompress the whole value.
- Post queries go through `findPosts` / `countPosts` / `countByStatus` / `postSlugs` (`server/data/posts-repo.ts`), so filtering, sorting and paging run in SQL; never load the whole table. Search (`?q=` on the published/archived lists) matches `posts.search_text`, the lowercased title + plain text maintained on every save (`server/data/post-search.ts`, migration 003; `npm run db:import` fills it for imported posts). Statistics are SQL aggregates (`server/data/statistics-repo.ts`).
- Permissions: no roles, per-account switchable capabilities (`shared/pnw/permissions.ts`); the page editor needs `pnw_manage_pages`, the library `pnw_manage_library`.
- POST/PUT `/api/pages` validate every block's fields against the shared schema; a violation is `422 invalid_fields` with `issues: [{ block, path, message }]`.
- **Shared-link previews:** `server/lib/page-meta.ts` fills `<title>`, description and `og:*` / `twitter:*` tags into `index.html` for `/hirek/:slug`, legacy `/<slug>` news, published Creator pages and built-in pages (the Docker image copies `src/pages/samples` for this). Absolute URLs use `PNW_PUBLIC_URL`.
- The public site gets published pages, the menu and the library from `GET /api/public/site` (`src/lib/SiteContentProvider.tsx`); if the server is unreachable the built-in content shows.

## Tests

`npm test` runs `tests/**/*.test.ts` with Node's built-in runner (`node --test`, no extra dependency). Each file runs in its own process and `tests/helpers/server.ts` gives it a fresh, random Postgres schema in `TEST_DATABASE_URL` (default `postgres://petrik:petrik@localhost:5432/petrik_test`; the database must exist), starts `createApp()` (`server/app.ts`) on a random port and seeds the demo accounts. Client components are tested by rendering them with Vite's `ssrLoadModule` + `react-dom/server` (`tests/helpers/render.ts`).

- `tests/api/` – HTTP-level tests against the real app and database.
- `tests/client/` – rendered React components.
- `tests/*.test.ts` – pure functions and repo-wide checks.

## Single-instance assumption

The app is meant to run as **one** process. The scheduled-publish sweep (`setInterval` in `server/index.ts`, every 60 s) and the rate limiters (`RateLimiter` in `server/security.ts`, in memory) would misbehave on two replicas (double publishing, double limits). This is deliberate; both sites carry a warning comment. Scaling out would need a DB lock for the sweep and a shared store for the limits.

## Security and operations

- **Production start** (`NODE_ENV=production`, the Docker image default): the server refuses to start without `PNW_SESSION_SECRET`, or if an account still has a publicly known demo password and `PNW_SEED_PASSWORD` is not set; when it is set, demo passwords are replaced at startup.
- **Sessions:** stored in Postgres (`sessions` table, `server/lib/pg-session-store.ts`); HttpOnly + SameSite=Lax cookie, `Secure` behind HTTPS, 7 days (extended on use), new id on login. `PNW_TRUST_PROXY` (1 in production) says how many proxies are in front.
- **Protections** (`server/security.ts`): CSP and related headers, HSTS on HTTPS, `/api` no-store, state-changing API calls only from the same origin (extend with `PNW_PUBLIC_URL` / `PNW_ALLOWED_ORIGINS`), login rate limit (8 per account, 30 per IP / 15 min), per-IP limit on modifying requests, JSON error handlers, `/healthz`.
- **Content:** `html` fields of Creator pages go through a whitelist filter on save (`server/lib/sanitize.ts`, `sanitize-html`; iframes only YouTube). Hírkezelő posts are structured, no raw HTML. Uploaded images are checked by extension and magic bytes; SVG and office files are served with a sandbox CSP.
- **Docker (dev):** `docker-compose.dev.yml` runs `postgres` (published on `127.0.0.1:5432`, `petrik`/`petrik`), a one-off `deps` service (`npm install --ignore-scripts` into the shared `node_modules` volume), `api` (`node --watch`, port 4000) and `web` (Vite on 5173, proxying to `api` via `VITE_PROXY_TARGET`, read in `vite.config.ts`). The repo is bind-mounted, so edits apply live. The dev database is the `pgdata-dev` volume; `npm run db:import` can fill it with `DATABASE_URL=postgres://petrik:petrik@localhost:5432/petrik`.
- **Docker (production):** `Dockerfile` (one Node process serving API + built client), non-root user, `cap_drop: ALL`, healthcheck, `restart: unless-stopped`. `docker-compose.yml` services: `postgres`, `petrik`, and `cloudflared` (profile `tunnel`).
- **Cloudflare Tunnel, one port:** a single Node process serves the API, media and the built client on `PNW_PORT` (default 4000; bound to `127.0.0.1` in compose). Point the tunnel's public hostname at `http://localhost:4000` (or `http://petrik:4000` inside compose); `docker compose --profile tunnel up` also starts `cloudflared` (`TUNNEL_TOKEN`). Set `PNW_PUBLIC_URL` (e.g. `https://petrik.hu`): it is the allowed origin for modifying calls if the tunnel rewrites the Host header. `PNW_TRUST_PROXY=1` makes the cookie `Secure` and the client IP real. The CSP is `script-src 'self'`, so disable Cloudflare's injected scripts (Web Analytics, Rocket Loader).
- **EC2 deployment guide:** `deploy.md` (step by step: EC2 + Docker + Cloudflare Tunnel, data import, backups, troubleshooting). It is git-ignored on purpose (internal notes), so it exists only in local checkouts; keep it in sync when deployment changes.
- **Environment variables:** `DATABASE_URL`, `POSTGRES_PASSWORD` (compose), `PNW_SESSION_SECRET`, `PNW_SEED_PASSWORD`, `PNW_PORT`, `PNW_PUBLIC_URL`, `PNW_ALLOWED_ORIGINS`, `PNW_TRUST_PROXY`, `PNW_UPLOADS_DIR`, `PNW_MEDIA_SEED_DIR`, `PNW_SHOW_DEMO_LOGINS`, `PNW_TEST_MODE`, `PNW_BACKUP_DIR` / `PNW_BACKUP_KEEP_DAYS` / `PNW_BACKUP_AT` (compose `backup` service), `PNW_SQLITE_FILE` (import script), `TUNNEL_TOKEN` (compose). See `.env.example` and `server/config.ts`.
- **Backups:** the `backup` compose service (`scripts/backup.sh`) writes a daily `pg_dump -Fc` to `PNW_BACKUP_DIR` (default `./backups`, git-ignored) and keeps `PNW_BACKUP_KEEP_DAYS` (14). Media is in the database, so the dump is the whole site. Restore steps are in README "Backups"; `tests/backup.test.ts` checks a dump → restore round trip. Copy backups off the instance.
- **Production:** runs on AWS EC2 behind Cloudflare at https://petriknew.zsombor.dev (`PNW_PUBLIC_URL`). `.github/workflows/production-check.yml` checks it every 6 h; it sends the GitHub secret `HEALTH_TOKEN` as an `X-Health-Token` header, and a Cloudflare WAF skip rule matching that header lets it past bot protection. Deployment is manual (`git pull` + `docker compose up -d --build` in `/petrik`, after `docker compose run --rm backup once`); see `deploy.md` locally.
- **Not present:** two-factor login.
