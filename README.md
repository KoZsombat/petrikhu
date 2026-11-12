# Petrikhu

Fullstack starter: a Bun/Hono API with better-auth, Drizzle and separately generated OpenAPI docs, an Astro SSR public site with SEO plumbing, and a React admin dashboard with granular permissions — all wired through Docker.

## Stack

| App                | Runtime / tooling                                                        | Purpose                                  |
| ------------------ | ------------------------------------------------------------------------ | ---------------------------------------- |
| `apps/api`         | Bun, Hono, `@hono/zod-validator`, Drizzle ORM (Postgres), better-auth, `zod-to-openapi` | JSON API, auth, clean Zod routes + Swagger docs |
| `apps/admin`       | React 19 + React Compiler, Vite, React Router, TypeScript, Zod           | Admin dashboard, better-auth client      |
| `apps/web`         | Astro SSR (`@astrojs/node`), Tailwind v4, React renderer for icons       | Static content pages + DB-driven news/teachers/documents + sitemap/RSS/JSON-LD |
| `db`               | Postgres 17                                                              | Persistence                              |

Zod validates API input, request/response payloads and forms in the admin app, and API env vars in the backend. The public Astro app only reads data. Admin access is permission-based: every route checks a named permission, and each account is created with exactly the permissions selected for it.

Only **posts**, **teachers**, **documents**, **post categories** and **media** bytes live in the database. Every other public page is
static Astro content. See [`CREATE.md`](CREATE.md) for the styling rules and component catalog, and [`AGENT.md`](AGENT.md)
for the architecture and working notes.

## Layout

```
apps/
  api/     Bun + Hono API
    src/auth.ts            better-auth config (email/password)
    src/db/                Drizzle schema, client, migration runner
    src/routes/posts.ts    Plain Hono routes for posts
    drizzle/               Generated SQL migrations (committed)
  admin/   React dashboard (SPA)
    src/lib/auth-client.ts better-auth React client
    src/components/        auth card, protected layout
    src/pages/             login, dashboard, posts, teachers, documents, users
  web/     Astro public site
    CREATE.md              page-building guide (styling rules + component catalog)
    src/pages/             static content pages, hirek/, tanari-kar, kereses, en/
    src/components/        layout, ui, home and teacher components
    src/lib/               API client, i18n, menus, formatting
docker-compose.yml
```

## Run with Docker

```sh
cp .env.example .env      # optional: set a real BETTER_AUTH_SECRET
docker compose up --build
```

| Service | URL                    | Notes                                |
| ------- | ---------------------- | ------------------------------------ |
| Web     | http://localhost:3003  | Astro SSR, reads published posts     |
| Admin   | http://localhost:3002  | Sign in with the seeded admin, manage content/users |
| API     | http://localhost:3001  | `/health`, `/api/*`                  |
| Swagger | http://localhost:3001/docs | UI for `/openapi.json`            |
| Postgres| localhost:5432         | `app` / `app`, database `app`        |

The API container runs the committed Drizzle migrations and the idempotent seed on startup (posts, documents,
teachers, plus the legacy WordPress media referenced by them), so the first boot is ready to use. Static pages are
prerendered at build time; the home page, news, search and teachers pages render on the server against the API.

## Local development

```sh
bun install
cp .env.example .env      # one shared env file for every app
docker compose up -d db

bun run db:migrate
bun run dev:api           # http://localhost:3001
bun run dev:admin         # http://localhost:5173
bun run dev:web           # http://localhost:4321
```

Or run every dev server at once:

```sh
bun run dev
```

`bun run typecheck` typechecks all three apps. `bun run build` builds the admin and Astro bundles.

## Environment

There is exactly **one** env file: `.env` in the repository root (template: `.env.example`). Do not create per-app
`.env` files. Docker Compose reads it automatically; the root `dev:*` scripts pass it to the API with
`--env-file`, and the admin Vite / Astro configs set `envDir` to the repository root.

| Variable | Default | Used by |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://app:app@localhost:5432/app` | API / Drizzle |
| `BETTER_AUTH_SECRET` | — (required, ≥ 32 chars) | API auth signing |
| `BETTER_AUTH_URL` | `http://localhost:3001` | Public API origin (media URLs use this) |
| `PORT` | `3001` | API |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3002,http://localhost:3003` | API CORS + better-auth |
| `ADMIN_EMAIL` | `admin@petrik.hu` | Seeded admin |
| `ADMIN_PASSWORD` | `PetrikAdmin2026!` | Seeded admin first-boot password |
| `ADMIN_RESET_PASSWORD` | `false` | Reset seeded admin password on boot |
| `LEGACY_MEDIA_BASE_URL` | `https://petrik.hu` | One-time legacy media seed |
| `VITE_API_URL` | `http://localhost:3001` | Admin browser → API |
| `VITE_WEB_URL` | `http://localhost:4321` | Admin links to the public site |
| `API_INTERNAL_URL` | `http://localhost:3001` | Astro server-side API reads (Docker: `http://api:3001`) |
| `PUBLIC_SITE_URL` | `http://localhost:4321` | Canonical/OG/sitemap origin (Docker: `http://localhost:3003`) |

Docker Compose overrides the container-specific values (`DATABASE_URL`, `API_INTERNAL_URL`, public origins) with
service hostnames. For production set `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PUBLIC_SITE_URL` and the admin
origins to real public URLs.

## API

```
GET    /api/posts              published posts (public; ?limit&offset&category&q)
GET    /api/posts/:slug       one published post (public)
GET    /api/teachers           published teaching staff (public)
GET    /api/documents          document library (public)
GET    /api/post-categories    news categories (public; used by the admin select)
GET    /api/admin/posts        all posts incl. drafts          posts.view
GET    /api/admin/posts/:id    one post with full content      posts.view
POST   /api/admin/posts        create post                    posts.create
PUT    /api/admin/posts/:id   update post                    posts.update (+ posts.publish when publishing)
DELETE /api/admin/posts/:id   delete post                    posts.delete
POST   /api/admin/posts/:id/submit  submit for review        posts.submit
POST   /api/admin/posts/:id/review  approve/reject           posts.review
GET|POST|PUT|DELETE /api/admin/teachers[/:id]                teachers.view / teachers.manage
GET|POST|PUT|DELETE /api/admin/documents[/:id]               documents.view / documents.manage
GET|POST|PUT|DELETE /api/admin/document-categories[/:id]     documents.view / documents.manage
GET|POST|PUT|DELETE /api/admin/users[/:id]                   users.view / users.manage
GET    /api/me/permissions                                    effective permissions (session)
GET    /api/admin/permissions                                 permission catalog       users.view
POST|PUT|DELETE /api/admin/post-categories[/:id]            posts.update
GET|POST /api/admin/media, DELETE /api/admin/media/:id     media.view/upload/delete (list is paged + ?q=)
GET    /api/media/:id                                       public image/document bytes
GET    /sitemap.xml                                         static pages + every published post
GET    /rss.xml                                             latest 50 posts
GET    /robots.txt                                          sitemap discovery + noindex paths
GET|POST /api/auth/*           better-auth handlers (sign-up/in/out, session)
GET    /openapi.json           generated OpenAPI 3.1 document
GET    /docs                   Swagger UI
GET    /health                 liveness
```

Protected routes call `auth.api.getSession()` against the request cookies and return `401` without a valid session,
then check the required permission and return `403` when it is missing.
The API also applies secure headers (helmet-equivalent CSP/HSTS/etc.), per-IP rate limiting
(300 req/min general, 30 req/min on `/api/auth/*`) and CORS for the admin and public origins. Rate-limit headers are
exposed to browsers. Request bodies and list queries are validated with Zod before the handler runs.

OpenAPI is generated **separately** in `apps/api/src/openapi.ts`: routes stay plain Hono handlers, while the registry
declares paths and reuses the same `src/types/*Types.ts` Zod schemas. Swagger UI is served at `/docs`, backed by
`/openapi.json`.

## Database changes

Edit `apps/api/src/db/schema.ts`, then:

```sh
bun run db:generate    # writes apps/api/drizzle/*.sql
bun run db:migrate     # applies against DATABASE_URL
```

The Docker API image ships the generated migrations and applies them on boot.

better-auth tables (`user`, `session`, `account`, `verification`) live in `apps/api/src/db/auth-schema.ts`, matching better-auth 1.7's default Drizzle schema.

`apps/api/seed` is a snapshot of the previous site: **584 posts** (WordPress HTML sanitized into `contentHtml`),
**30 documents** in 11 categories and **88 teachers**, plus the **25 post categories** found in the old posts. `bun run --cwd apps/api db:seed` (also run by the API
container) fills empty tables only, so existing edits are never overwritten.

The same seed also reads the old `/tanari-kar/` page to copy each teacher portrait (88 matched by name), then imports
every legacy `/wp-content/uploads/...` referenced by posts, documents and teachers into the `media` table (deterministic `legacy-<sha1>` ids, served from `/api/media/{id}`) and rewrites those references in
place. It is idempotent, so later boots reuse the stored bytes; the first boot downloads ~2.2k files from
`LEGACY_MEDIA_BASE_URL`. Six references that 404 on the old site are skipped and keep their original URLs.

## Auth notes

- `apps/admin` is the only app that authenticates. The public Astro site only reads published posts, teachers and documents.
- Public registration is disabled (`POST /api/auth/sign-up/email` returns `403`). Accounts are created by an admin in
  **Felhasználók**.
- The seeded admin (`ADMIN_EMAIL`) is created on the first boot with `ADMIN_PASSWORD`, implicitly has every
  permission and cannot be deleted. Set `ADMIN_RESET_PASSWORD=true` for one boot to reset its password.
- Accounts have **no roles**: a new account is created with exactly the permissions chosen in the create dialog
  (dashboard is preselected). Permissions are named capabilities (`posts.update`, `documents.manage`,
  `users.permissions`, …); the catalog is returned by `GET /api/admin/permissions`, effective permissions by
  `GET /api/me/permissions`.
- Anyone holding `users.permissions` can edit an account's permission set from the shield icon in **Felhasználók**.
  Changes take effect on the next request; the admin navigation and action buttons are filtered by the same set.
- New posts are created as **drafts**. Authors submit them for review; reviewers/admins approve (publish) or send them
  back with a note. The **Áttekintés** page lists every pending post with approve/reject actions.
- Images and documents are stored in the `media` table (served from `/api/media/{id}`). Both the cover/gallery image
  picker and the document picker upload/select from the same library; the public site shows the old-site portrait
  or the school placeholder when a teacher has no photo.
- The admin UI automatically follows the browser language (HU/EN switch in the header).
- better-auth's default rate limiter is active. Repeated failed sign-ins return `429` with "Too many requests".
- Cross-origin cookies work because admin and API share the `localhost` site (different ports) in this setup. On separate domains, set `BETTER_AUTH_URL`, add the admin origin to `CORS_ORIGINS`, and use HTTPS so cookies are `Secure`.

## SEO

The Astro layout emits a canonical URL, hu/en `hreflang` alternates (with `x-default`), robots directives, Open Graph
and Twitter cards, article timestamps, RSS discovery and schema.org JSON-LD (`WebSite`, `HighSchool`,
`NewsArticle`, `BreadcrumbList`). `/sitemap.xml` is generated on the server so new posts appear without a rebuild;
`/robots.txt` points at it and excludes `/kereses`; `/rss.xml` exposes the latest 50 posts. Set `PUBLIC_SITE_URL` to
the real public origin in production so canonicals and media URLs are absolute.

## CI

`.github/workflows/ci.yml` runs on every push and pull request: Bun install (`--frozen-lockfile`),
`bun run typecheck`, `bun run build`, then `docker compose config` and `docker compose build`. The same verification is available locally
with `bun run ci`. `.gitignore` excludes dependencies, build output, environment files and local tooling.

## Admin features

- Post form: reusable **templates** (general news, open day, competition, job, menu, in memoriam, project,
  Erasmus+), cover image and a TipTap toolbar that inserts images, **galleries** (multi-select, max 24 per block)
  and tables with a rows × columns selector. Existing WordPress `<figure>` galleries were converted to the same
  gallery block on seed/boot (43 posts). Editing fetches the full post from `/api/admin/posts/:id`, so legacy
  content is not lost.
- About page uses richer blocks: icon metric cards, a sticky history rail with scroll-reveal entries, an awards
  showcase and a further-reading card.
- Teacher page uses the `NEW PETRIK SITE` person-card design, enlarged: 3 columns on desktop, 80 px round photo or
  initials, stronger card border/shadow on a darker cream band for contrast.
- Media library is paged (60 at a time) with server-side name search (`?q=`) and a **Továbbiak betöltése** button;
  this prevents the admin from requesting thousands of seeded images at once.
- Category: the post form uses a select populated from `/api/post-categories` with a **+ Új kategória** dialog;
  it is no longer a free-text input.
- Document form: upload or select a PDF/Office/TXT/CSV/ZIP from the media library (max 25 MB), same dialog pattern as
  images.
- Accounts: permission checkboxes only — no role selector, no role column. The seeded admin is implicit full access.
