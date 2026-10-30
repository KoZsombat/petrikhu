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

Other scripts: `npm run build`, `npm run lint`, `npx tsc -p tsconfig.server.json` (type-check the server), `npm run db:import` (one-off copy of the legacy SQLite data into Postgres).

## Production (Docker + Cloudflare Tunnel)

One Node process serves the API, media and the built frontend on a single port (4000), so only that port needs to be exposed.

```
cp .env.example .env     # set POSTGRES_PASSWORD, PNW_SESSION_SECRET, PNW_SEED_PASSWORD, PNW_PUBLIC_URL
docker compose up -d                       # postgres + app (127.0.0.1:4000)
docker compose --profile tunnel up -d      # ...plus cloudflared (set TUNNEL_TOKEN)
```

In Cloudflare, point the tunnel's public hostname at `http://petrik:4000` (or `http://localhost:4000` if `cloudflared` runs on the host). Back up Postgres with `pg_dump`.

## Where things are

- `docker-compose.yml` (production) and `docker-compose.dev.yml` (development)
- `src/pages/samples/pages.json` – built-in subpages; `src/pages/creatorSchema.ts` – the editor schema
- `src/components/creator/` – page components + `PageRenderer`
- `src/pages/Dashboard.tsx` – admin (pages, menu, media, document library)
- `server/` – Express API, Postgres repos, sessions, security; `shared/pnw/` – shared types

Details, conventions and pitfalls are in [AGENTS.md](AGENTS.md), which must be updated with every change.
