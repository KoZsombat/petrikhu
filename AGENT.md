# AGENT.md — working notes for this repository

This is the operating manual for agents working on **petrikhu**. Read it before changing anything. It describes the
architecture, hard rules, commands, and the current known gaps.

## Maintenance rule (hard)

**Update this file in the same change whenever behavior, architecture, commands, API contracts, permissions, or known
gaps change.** It is the source of truth for the next agent; never leave it describing something that no longer
exists. If a change touches how the system works, the diff is not complete until `AGENT.md` matches it.

## What this is

A fullstack base for the Petrik Lajos school site:

| App | Stack | Role |
| --- | --- | --- |
| `apps/api` | Bun, Hono, `@hono/zod-validator`, `zod-to-openapi`, Drizzle + Postgres, better-auth | JSON API, auth, clean Zod routes, OpenAPI/Swagger, database |
| `apps/admin` | React 19, React Compiler, Vite, React Router, TypeScript, Zod, lucide-react | Admin dashboard + the only better-auth client |
| `apps/web` | Astro 7 (server output + selective prerender), Tailwind v4, React renderer for lucide icons | Public site: static content pages + DB-backed news/teachers/documents |

One Postgres, four containers: `db`, `api`, `admin` (nginx), `web` (Node standalone).

## Commands

```sh
bun install
bun run typecheck                  # all workspaces (web uses astro check on TS 6)
bun run build                      # admin Vite + Astro build
bun run ci                         # typecheck + build (same as GitHub Actions)

docker compose up --build          # full stack, fresh DB, migrations + content/media seed
docker compose down -v             # stop and drop the volume

bun run dev:api                    # API :3001 (loads root .env)
bun run dev:admin                  # Vite :5173
bun run dev:web                    # Astro :4321

bun run db:generate                # Drizzle migration from schema changes
bun run db:migrate                 # apply migrations (loads root .env)
bun run db:seed                    # idempotent content + legacy media seed
```

Ports: web `3003`, admin `3002`, API `3001`, Postgres `5432` (in Docker), Swagger `/docs`, OpenAPI `/openapi.json`.

## Data ownership (hard rule)

**Only five things come from the database:** `posts` (news), `teachers`, `documents`, `post_categories`, and
uploaded/seeded `media` bytes. Every other public page is static Astro content checked into this repository.

- Static pages: `apps/web/src/pages/<slug>.astro` with `export const prerender = true`.
- Dynamic pages (`prerender = false`): `/`, `/hirek`, `/hirek/[slug]`, `/tanari-kar`, `/kereses`, `/dokumentumtar`,
  `/en`.
- Never add a generic page creator/block renderer back. Pages are explicit components.

### API contract

| Endpoint | Status | Shape |
| --- | --- | --- |
| `GET /api/posts?limit&offset&category&q` | done | `{ posts: PostSummary[], total: number }` |
| `GET /api/posts/{slug}` | done | `Post` |
| `GET /api/teachers` | done | `Teacher[]` |
| `GET /api/documents` | done | `{ categories: [{ slug, title, docs: [{ slug, title, file, protected? }] }] }` |
| `GET /api/post-categories` | done | `PostCategory[]` |
| `POST/PUT/DELETE /api/admin/post-categories[/{id}]` | done | `posts.update`; rename updates posts, delete refuses used categories |
| `GET/POST /api/auth/*` | done | better-auth |
| `GET /api/admin/posts`, `GET /api/admin/posts/{id}` | done | summaries / full post (`posts.view`) |
| `POST/PUT/DELETE /api/admin/posts` | done | `posts.create/update/delete` |
| `GET/POST/PUT/DELETE /api/admin/teachers` | done | `teachers.view` / `teachers.manage` |
| `GET/POST/PUT/DELETE /api/admin/documents` | done | `documents.view` / `documents.manage` |
| `GET/POST/PUT/DELETE /api/admin/document-categories` | done | `documents.view` / `documents.manage` |
| `GET /api/admin/media?kind&limit&offset&q` | done | paged media list |
| `POST /api/admin/media`, `DELETE /api/admin/media/{id}` | done | upload/delete media |
| `GET /api/admin/users`, `GET /api/admin/permissions` | done | accounts/catalog (`users.view`) |
| `POST/PUT/DELETE /api/admin/users` | done | `users.manage` / `users.permissions` |

`PostSummary`: `id, title, slug, excerpt, category, image, gallery, publishedAt`. `Post` adds plain-text `content` and
`contentHtml` (sanitized legacy HTML, rendered by the public article page).
`Post` includes `gallery: string[]` (max 24). `Teacher`: `id, name, role, email, room, photo`.
`LibraryCategory`: `{ slug, title, docs: Document[] }`.

`apps/api/seed` holds the previous site snapshot: 584 WordPress posts, 30 documents (11 categories) and 88
teachers. The seed runs on boot and only fills empty tables.

All write routes require the better-auth session cookie plus the named permission. The admin UI mirrors those
permissions in its navigation and action buttons, but the server is the authority.

## Frontend rules (apps/web)

Read `CREATE.md` for the full component catalog and styling recipes. The short version:

- Tailwind v4 only. Use the `petrik*` tokens from `src/styles/theme.css`; no raw colours.
- **Section background rule:** `<section>` may use only `bg-petrikcream` or `bg-petrikbg`; the hero is exempt.
  Apply this directly instead of adding another background token. Do not add a heading-only `RichTextSection` before
  an `Accordion`/`CardGrid`/`DocumentGrid`; pass the `heading` prop instead.
- Fonts: exactly two — `font-display` (Newsreader) for headings and `font-body` (Archivo) for copy, UI, labels,
  dates and table headers (uppercase tracking or `tabular-nums`, never a third family). Eyebrow utility:
  `petrik-eyebrow`.
- Layout: `Container` = 1240 px and the only page width. `PageHero` owns the `h1`. Global CSS owns section
  rhythm: `main section` gets `padding-block: 1.5rem` / `2rem` from `md`; never add `py-*` to a section.
- Card contract: `rounded-xl border border-petrikline bg-petrikcard`; hover may change border, add restraint shadow,
  or translate 0.5. No `rounded-lg` panels or heavy shadows.
- Motion: 150–300 ms, transform/opacity only, and `prefers-reduced-motion` must disable it.
- Static HTML goes through `RichTextSection` (section + container + prose) at page level; `Prose` only inside a
  block that already provides the container. Plain-text DB post bodies go through `PostContent`.
- Images/assets live in `apps/web/public` (`img/`, `fonts/`, `media/`). Legacy `/media/...` images that never
  shipped are omitted by components that accept structured images.

### Translation model

- **Chrome/navigation translates automatically** from `src/lib/i18n.ts` dictionaries (`t("nav.news")` style keys).
  Missing English strings fall back to Hungarian; missing keys fall back to the key.
- **Only selected pages have static translations.** They are listed in `TRANSLATIONS`:
  `bemutatkozas ↔ about-us`, `nyolcadikos ↔ admissions`, `elerhetoseg ↔ contact`. Those exist as hand-written
  `src/pages/en/*.astro` files.
- `localizedHref(locale, href, TRANSLATIONS)` automatically maps a Hungarian path to its static English version
  when one exists, otherwise keeps the Hungarian path. Menus/footer/home CTAs use it.
- The language switch (`counterpart`) sends the visitor to the translated page when it exists, otherwise to that
  language's home page.
- Page **bodies** of untranslated pages remain Hungarian. There is no machine-translation service. If automatic
  content translation is added later, it must plug into the page-level translation map, not duplicate every page.

## Backend conventions (apps/api)

- Routes are plain Hono handlers (`app.get/post/put/delete`) with Zod middleware from `src/validation.ts`.
  Input schemas live per domain in `src/types/*Types.ts` (`postTypes.ts`, `docTypes.ts`, `teacherTypes.ts`,
  `categoryTypes.ts`, `userTypes.ts`). Handlers stay in `src/routes/*.ts`. Protected routes use
  `requirePermission("posts.view")`; `requireAuth` exists for session-only routes (`/api/me/permissions`).
- OpenAPI is built separately in `src/openapi.ts` with `@asteasolutions/zod-to-openapi`; `src/zod-openapi.ts` extends
  Zod before any schema module loads. Do not put route metadata back into the handlers. Swagger UI is mounted at
  `/docs` and `/openapi.json` in `index.ts`.
- Permissions live in `src/permissions.ts`: a stable-key catalog and `effectivePermissions(role, extra)`.
  `requirePermission` loads the account's direct `user_permissions` rows and returns `403` with the missing keys.
  The seeded admin (role `admin`, internal only) gets every permission without a DB read.
- Accounts have **no user-facing roles**. `user.role` remains only as better-auth plumbing (`inactive` for every
  created account, `admin` for the seeded admin); permission decisions use `user_permissions` only.
  Public sign-up is blocked at the HTTP layer; only `/api/admin/users` creates accounts.
- The seeded admin comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD`; the seed creates it once, forces `admin`, and the
  users routes refuse to delete or demote it. `ADMIN_RESET_PASSWORD=true` resets the password on the next boot.
- Posts have `status`: `draft` → (submit) `pending` → (approve) `published`, or reject back to `draft` with
  `reviewNote`. Public endpoints only read `published`; the dashboard shows pending posts with review actions.
- `media` stores uploaded image bytes and seeded legacy documents in Postgres; `/api/media/{id}` serves them,
  `/api/admin/media` lists only image MIME types and uploads/deletes. Stored URLs use `BETTER_AUTH_URL` — keep it
  pointing at the public API origin.
- `src/db/seed-media.ts` imports every `/wp-content/uploads/...` asset referenced by posts/documents/teachers from
  `LEGACY_MEDIA_BASE_URL` (default `https://petrik.hu`), stores it with a deterministic `legacy-<sha1>` id, and
  rewrites the references. It runs after content seeding, is idempotent, and only downloads missing ids.
- `Post` responses include both `publishedAt` (derived from `createdAt`) and the raw timestamps; the public list is
  an envelope, the admin list is a raw array.
- Post category is a plain string used by `?kategoria=` filtering. `q` searches title and content (`ilike`).
- Teachers are seeded once when the table is empty (`src/db/seed.ts`); the API container runs migrations + seed then
  starts.
- better-auth tables live in `src/db/auth-schema.ts` and match better-auth 1.7's default Drizzle schema.

## Admin conventions (apps/admin)

- The UI uses the public site's visual language: cream/paper `#F1EBDF` (page), white `#FFFFFF` (surfaces), ink
  `#16211D`, green `#2B8272`, Archivo body and Newsreader headings. The page/surface contrast is deliberate for the
  admin; do not collapse it back to near-white. Tailwind v4 runs through `@tailwindcss/vite`; `src/styles.css` contains
  only the Tailwind import, `@theme` tokens and `@font-face`. Both Astro and admin use the same pipeline and tokens.
- All component styling is Tailwind utilities: structural classes live directly in the JSX; repeated recipes (button,
  input, panel, table, badge, dialog, editor) are exported as class strings from `lib/ui.ts` and consumed inline.
  There is no component CSS and no separate stylesheet to grow. Do not reintroduce the old dark theme.
- Pages: `DashboardPage` (counts + pending review), `PostsPage` (dialogs, search/pagination, rich editor, media
  picker, submit/review), `TeachersPage`, `DocumentsPage` (categories + documents), `UsersPage` (admin only).
  Create/edit forms live in `Dialog`; the header has a second navigation row. Login only; no register screen.
- About page: `StatCards`, `HistoryRail`, `AwardsShowcase`, `FurtherReading` and `VideoGrid` are the reference
  examples for richer blocks.
- Teacher page: three-column person cards (reference `CardGrid variant="person"`), 80 px round photo (or initials),
  larger padding, stronger border + shadow, and a darker `bg-petrikbg` band so white cards remain distinct on poor
  monitors. Images lazy-loaded.
- `lib/i18n.tsx` auto-localizes the rendered admin chrome to English based on the browser language, with a HU/EN
  switch. New UI strings must be added to its Hungarian→English dictionary. Database content is not translated.
- Posts use TipTap (`RichTextEditor`) and store HTML in `contentHtml`; `content` keeps the plain text for search.
- New posts can start from `lib/postTemplates.ts` (Hír, Nyílt nap, Versenyeredmény, Állásajánlat, Étkezés,
  In memoriam, Projekt, Erasmus+). Templates only prefill excerpt/category/content; they never overwrite on edit.
  The editor toolbar has a rows × columns selector for tables and an **insert gallery** button with a multi-select
  media dialog. Post cover and inline editor images go through `MediaPickerDialog`, never a URL input. The form-level
  gallery field was removed; `posts.gallery` remains only as a legacy column and still renders below the article if
  populated.
- Documents use `DocumentField` + `MediaPickerDialog kind="document"`; the same dialog uploads/selects docs and
  filters `GET /api/admin/media?kind=document`. Media upload accepts images plus PDF/Office/TXT/CSV/ZIP up to 25 MB.
- The media dialog loads 60 items at a time (`limit`/`offset`), searches by name (`q`), and offers **Továbbiak
  betöltése**. Do not remove pagination: the seed has ~2.1k media rows.
- Editing a post calls `getAdminPost(id)` because `/api/admin/posts` returns summaries without content. Do not
  populate the editor from the list row.
- Post categories are a DB table (`post_categories`), seeded from the distinct categories in the old posts. The
  post form uses a select plus a create dialog; `/hirek` builds its filter bar from the same endpoint.
- `src/db/seed-galleries.ts` converts old outer-`<figure>` image runs into `[data-gallery]` blocks (43 posts), so they
  render as grids and round-trip through the editor gallery node.
- `ProtectedLayout` loads `GET /api/me/permissions`, provides the effective set through `PermissionsContext`, and
  filters nav items by their permission. Pages/actions use `usePermissions()` (`posts.create`, `documents.manage`,
  `users.permissions`, …). The server is the authority: an API `403` is shown as an error, never worked around in
  the UI.
- **Felhasználók** has no role UI. The create dialog and shield icon both show the shared `PermissionPicker`
  (catalog from `/api/admin/permissions`); selection is saved through `PUT /api/admin/users/{id}` with
  `{ permissions }`. Creating needs `users.manage`; granting needs `users.permissions`.
- The admin and public site share the same favicons (`favicon-32.png`, `icon-192.png`, `apple-touch-icon.png`) from
  each app's `public/` folder. Do not substitute an emoji favicon.

- better-auth React client (`src/lib/auth-client.ts`), base URL `VITE_API_URL + /api/auth`.
- `ProtectedLayout` force-refetches the session on mount. This is deliberate: better-auth's cached session can be a
  stale `null` after sign-out → sign-in within its dedupe window; without the refetch the guard bounces to `/login`.
- No register route: accounts are created from **Felhasználók** with name, email, password and permissions.
- React Compiler runs through `reactCompilerPreset()` + `@rolldown/plugin-babel` in `vite.config.ts`. Pathological
  hook code will fail compilation rather than be silently skipped.
- Zod validates forms and API payloads in `src/lib/schemas.ts` / `src/lib/api.ts`.

## Docker notes

- Bun 1.4 uses the **isolated linker**: dependencies live in `node_modules/.bun` and per-workspace symlinks.
  Dockerfiles copy the whole dependency tree from the build stage rather than re-installing production deps.
- `apps/web` reads `PUBLIC_SITE_URL` at runtime first, then the build arg. Docker passes both (build arg
  `http://localhost:3003`); production must set the real public origin.
- The web image is Node (`node:22-alpine`) and serves `dist/server/entry.mjs`; admin is static files behind nginx
  with SPA fallback; API is `oven/bun` and runs migrate → seed → start.
- Documents are served from the API (`/api/media/{id}`); `apps/web/public/media` is legacy static content and is not
  the source of truth.

## SEO (apps/web)

- `Layout.astro` emits title/description, canonical, hu/en `hreflang` + `x-default`, robots, OG/Twitter, article
  times, RSS discovery, and one `@graph` JSON-LD with `WebSite`, `HighSchool` and page nodes. `PageHero` adds
  `BreadcrumbList`; the article page adds `NewsArticle` + breadcrumbs.
- `pages/sitemap.xml.ts` includes static routes discovered via `import.meta.glob` plus every published post
  (paged API fetch). `pages/rss.xml.ts` exposes the latest 50 posts. `pages/robots.txt.ts` points at the sitemap and
  disallows `/kereses`. All are server-rendered, so posts appear without a rebuild.
- Canonicals are absolute via `SITE_URL` in `src/lib/seo.ts`; `PUBLIC_SITE_URL` must be the real origin in production.

## CI

- `.github/workflows/ci.yml` runs on every push and pull request: `bun install --frozen-lockfile`,
  `bun run typecheck`, `bun run build`, then `docker compose config --quiet` and `docker compose build`.
- `bun run ci` is the local equivalent of the verify job.
- `.gitignore` excludes dependencies, build output, `.env*` (root `.env.example` excepted), logs and editor/OS files.
- OpenAPI generation must run after `src/zod-openapi.ts`; that setup import must stay first in `src/openapi.ts`.
- There is exactly one env file: the root `.env`. `dev:*` scripts pass it with `--env-file`; admin Vite and Astro set
  `envDir: "../../"`. Do not add per-app env files.

## Known gaps / gotchas

1. `astro check` does **not** support TypeScript 7. `apps/web` pins TypeScript 6 only for this; api/admin use TS 7.
2. The old static `RowList/news` content on pages like `/allas`, `/ebed`, `/in-memoriam` links to legacy
   `/hirek/<old-slug>` URLs. Those posts are not in the new database and will 404 until curated or replaced with
   category-driven news lists.
3. Teacher portraits are seeded from the old `/tanari-kar/` page (88/88 matched by normalized name); missing files
   use the old `tanarur.png`/`tanarno.png` placeholders. Post images and document links are seeded into `media` and
   rewritten to `/api/media/{id}`; six old-site references 404 and keep their original URL.
4. Public registration is disabled. Change the default `ADMIN_PASSWORD`/`BETTER_AUTH_SECRET` before deploying;
   existing admin passwords are only reset with `ADMIN_RESET_PASSWORD=true`.
5. `docker compose down -v` removes the database; the next boot re-seeds posts, documents and teachers.

## Verification checklist

After a change:

```sh
bun run typecheck                                     # 0 errors everywhere
bun run --cwd apps/web build                          # prerender + SSR build
docker compose up --build                             # end-to-end
curl -s localhost:3001/health
curl -s localhost:3001/health | jq .
curl -s -o /dev/null -w '%{http_code}\n' localhost:3003/ localhost:3003/bemutatkozas localhost:3003/hirek
```

For UI changes, open the page in a browser (desktop + 390 px mobile), check the sticky menu, the language switch,
and that the page has exactly one `h1`.
