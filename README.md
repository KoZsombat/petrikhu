# Petrik site

New website for Petrik Lajos Bilingual Technical School (petrik.hu) with a built-in **page editor (Creator)**: subpages are JSON arrays of ready-made components, so content can be edited without coding. The UI and content are Hungarian.

**Stack:** React 19, TypeScript, Vite 8, React Router 7, Tailwind CSS 4 · Express 5 + PostgreSQL.

## Quick start

**With Docker (recommended):** starts PostgreSQL, the API (`node --watch`) and Vite with hot reload, nothing else to install.

```
docker compose -f docker-compose.dev.yml up
```

Site: http://localhost:5173 (proxies `/api`, `/uploads`, `/media` to the API) · API: http://localhost:4000 · Postgres: `localhost:5432` (`petrik`/`petrik`). An empty database gets 3 demo accounts (`igazgato`, `helyettes`, `mk.vezeto`). Stop with `docker compose -f docker-compose.dev.yml down` (add `-v` to wipe the dev database).

**Without Docker:**

```
npm install
cp .env.example .env     # fill in the values, DATABASE_URL must point to a reachable PostgreSQL
npm run dev              # frontend (Vite); /api, /uploads, /media proxy to port 4000
npm run server           # backend on port 4000
```

Other scripts: `npm run build`, `npm run lint`, `npx tsc -p tsconfig.server.json` (type-check the server), `npm test` (test suite; needs a Postgres database, default `postgres://petrik:petrik@localhost:5432/petrik_test`, override with `TEST_DATABASE_URL`), `npm run db:import` (one-off copy of the legacy SQLite data into Postgres).

## Production (Docker + Cloudflare Tunnel)

One Node process serves the API, media and the built frontend on a single port (4000), so only that port needs to be exposed.

```
cp .env.example .env     # set POSTGRES_PASSWORD, PNW_SESSION_SECRET, PNW_SEED_PASSWORD, PNW_PUBLIC_URL
docker compose up -d                       # postgres + app (127.0.0.1:4000)
docker compose --profile tunnel up -d      # ...plus cloudflared (set TUNNEL_TOKEN)
```

In Cloudflare, point the tunnel's public hostname at `http://petrik:4000` (or `http://localhost:4000` if `cloudflared` runs on the host). Back up Postgres with `pg_dump`.

## Backups

The whole site lives in Postgres, media files included (`media_files`), so one dump is a full backup. The `backup` service in `docker-compose.yml` runs `scripts/backup.sh`: a `pg_dump --format=custom` every day at `PNW_BACKUP_AT` (default `03:30` UTC) into `PNW_BACKUP_DIR` (default `./backups` next to the compose file), keeping `PNW_BACKUP_KEEP_DAYS` days (default 14). Copy that folder off the server too (e.g. to S3), since a backup on the same EC2 disk does not survive losing the instance.

```bash
docker compose run --rm backup once
```

**Restore** (replaces the current data):

```bash
docker compose stop petrik
```

```bash
docker compose exec -T postgres pg_restore --clean --if-exists --no-owner -U petrik -d petrik < backups/petrik-YYYYMMDD-HHMMSS.dump
```

```bash
docker compose start petrik
```

On start the server runs any newer migrations on top of the restored schema. Test a restore now and then into a scratch database (`createdb -U petrik scratch`, then `pg_restore -d scratch ...`); `tests/backup.test.ts` does exactly that in CI.

## CI

`.github/workflows/ci.yml` runs lint, the server type-check, the build and `npm test` (against a Postgres 17 service) on every push and pull request. `.github/workflows/production-check.yml` checks every 6 hours (or on demand) that https://petriknew.zsombor.dev answers `/healthz`, the public API and serves the Open Graph tags (it needs the `HEALTH_TOKEN` repository secret, matched by a Cloudflare WAF skip rule on the `X-Health-Token` header).

Deployment is manual: on the server, in `/petrik`, run `git pull` and `docker compose up -d --build`. Take a backup first (`docker compose run --rm backup once`), because new migrations run on start.

## Where things are

- `docker-compose.yml` (production) and `docker-compose.dev.yml` (development)
- `src/pages/samples/pages.json` – built-in subpages; `src/pages/creatorSchema.ts` – the editor schema
- `src/components/creator/` – page components + `PageRenderer`
- `src/pages/Dashboard.tsx` – admin (pages, menu, media, document library)
- `server/` – Express API, Postgres repos, sessions, security; `shared/pnw/` – shared types

Details, conventions and pitfalls are in [AGENTS.md](AGENTS.md), which must be updated with every change.
