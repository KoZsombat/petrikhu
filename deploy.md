# Deploying on Launchpad

The stack is deployed by [Launchpad](https://github.com/KoZsombat/Launchpad) as a **compose
project**. Launchpad scans the compose file, publishes the selected services through Traefik and
Cloudflare Tunnel, and redeploys on every push.

```
Internet ── HTTPS ──> Cloudflare (petrik.zsombor.dev, petrik-admin.zsombor.dev)
                            │ Cloudflare Tunnel
                            ▼
                         traefik
              ┌─────────────┴───────────────┐
              ▼                             ▼
   web  (Astro SSR, :4321)          admin (nginx, :80)
      │  /api/* proxied                 │ browser calls
      ▼                                 │ https://petrik.zsombor.dev/api/*
   api  (Hono, :3001)  ◄────────────────┘   through the web proxy
      │
      ▼
   db   (Postgres, internal)
```

Two public hostnames:

| Hostname | Service | Purpose |
| --- | --- | --- |
| `petrik.zsombor.dev` | `web` | Public site **and** the `/api` proxy |
| `petrik-admin.zsombor.dev` | `admin` | Content admin (React SPA) |

`api` and `db` are never published: the site proxies `/api/*` to the API container, so media URLs,
auth cookies and the admin app all share the site origin.

## 1. Launchpad prerequisites

- Launchpad is running with `BASE_DOMAIN=zsombor.dev` and the shared `web` Docker network.
- The Cloudflare wildcard hostname (`*.zsombor.dev`) points at Traefik, as described in Launchpad's
  own README.
- The repository is on GitHub with `compose.prod.yaml` on the branch you deploy.

## 2. Create the project

1. Launchpad → **New app** → **Compose project**.
2. Source: **GitHub repository**, branch `main`, compose path `compose.prod.yaml`.
3. **Scan compose**. Launchpad pre-fills each service's container port from the `expose:` entries,
   and asks which services are published. Publish exactly two:

   | Service | Container port | Health path | Subdomain |
   | --- | --- | --- | --- |
   | `web` | `4321` | `/` | `petrik` |
   | `admin` | `80` | `/` | `petrik-admin` |

   Leave `api` and `db` **unpublished**. The scan *suggests* publishing `api` because 3001 looks like
   an HTTP port — uncheck it; it is reached only through the site's `/api` proxy. `db` is detected as
   a data service and stays internal. Launchpad removes host ports from published services and puts
   them on the `web` network with Traefik labels; this stack publishes no ports to begin with.
4. Deployment target: **This host**.

## 3. Compose variables

Launchpad lists every `${VAR}` placeholder. Fill them with values from `.env.prod.example`:

| Variable | Value |
| --- | --- |
| `SITE_ORIGIN` | `https://petrik.zsombor.dev` |
| `ADMIN_ORIGIN` | `https://petrik-admin.zsombor.dev` |
| `POSTGRES_USER` | `petrik` |
| `POSTGRES_PASSWORD` | a long random password, URL-safe characters only (`@`, `:`, `/`, `?` break `DATABASE_URL`) |
| `POSTGRES_DB` | `petrik` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `ADMIN_EMAIL` | your e-mail |
| `ADMIN_PASSWORD` | a unique password, at least 8 characters |
| `ADMIN_RESET_PASSWORD` | `false` (set `true` once to reset the seeded admin) |

`SITE_ORIGIN`, `ADMIN_ORIGIN`, `BETTER_AUTH_SECRET` and `ADMIN_PASSWORD` are the load-bearing ones:
Better Auth rejects a browser origin that is not `SITE_ORIGIN`, media URLs are built from it, and
the API refuses to start in production with the development secret or password.

## 4. Deploy

Submit. Watch the deployment log:

1. `db` starts and passes `pg_isready`.
2. `api` applies Drizzle migrations, seeds the admin account, then answers `/health`.
3. `web` builds Astro and starts on `:4321`; `admin` serves the SPA on `:80`.
4. Launchpad publishes both hostnames through Traefik.

Open `https://petrik.zsombor.dev` (public site) and `https://petrik-admin.zsombor.dev` (sign in
with `ADMIN_EMAIL` / `ADMIN_PASSWORD`).

## 5. Protecting the admin hostname

The admin app has its own login, but put it behind **Cloudflare Access** like the panel itself:
Zero Trust → Access → Add a self-hosted application for `petrik-admin.zsombor.dev`, policy
Allow → your e-mail. The public site needs no Access policy.

## 6. Redeploys

Compose projects use the push webhook, not the Actions workflow:

1. In the project, open the webhook URL and per-app secret from the Launchpad panel.
2. GitHub → repository → Settings → Webhooks → Add webhook:
   - Payload URL: the Launchpad webhook URL for this project,
   - Content type: `application/json`,
   - Secret: the webhook secret,
   - Events: **Just the push event**.
3. Push to the deployed branch. Launchpad re-reads the compose file, rebuilds the images and swaps
   the stack. The previous stack is started again if the new one fails to become healthy.

The Postgres data lives in the named volume `pgdata`, which Launchpad stores as
`launchpad-<app>-pgdata`, so it survives redeploys.

## 7. Verify a deployment

```bash
curl -sS https://petrik.zsombor.dev/ | head -5      # public site
curl -sS https://petrik.zsombor.dev/api/posts       # API through the site proxy
curl -sS -o /dev/null -w '%{http_code}\n' https://petrik-admin.zsombor.dev/
```

`/health` is internal: check it from the host with
`docker compose -f compose.prod.yaml exec api bun -e "fetch('http://127.0.0.1:3001/health').then(r => console.log(r.status))"`.

## 8. Running the production stack locally

```bash
cp .env.prod.example .env.prod
# fill in the values, then:
docker compose -f compose.prod.yaml --env-file .env.prod up -d --build
docker compose -f compose.prod.yaml exec web wget -qO- http://127.0.0.1:4321/ | head -5
```

To browse it locally, add a throwaway override that publishes `web`:

```yaml
# compose.local.yaml
services:
  web:
    ports:
      - "3003:4321"
```

```bash
docker compose -f compose.prod.yaml -f compose.local.yaml --env-file .env.prod up -d --build
```

`SITE_ORIGIN` must then be `http://localhost:3003` for the CSP, canonical URLs and Better Auth
origin checks to match.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `502` on the site | `web` is running and listening on `4321`; the health path is `/`. |
| Site loads, no news | `web` cannot reach `api`: check `API_INTERNAL_URL=http://api:3001` and that `api` is healthy. |
| `/api/...` returns 500 | The container entry is `node server.mjs`; a plain `node dist/server/entry.mjs` has no proxy. Check the `web` logs. |
| Admin login says "Invalid origin" | `SITE_ORIGIN` must exactly match the browser origin (scheme + host, no trailing slash). |
| Admin loads but every request 401 | `CORS_ORIGINS` must contain both `SITE_ORIGIN` and `ADMIN_ORIGIN`; cookies are set on the site origin. |
| API exits immediately | `BETTER_AUTH_SECRET` or `ADMIN_PASSWORD` still the development default; the log says which. |
| 429 for everyone at once | `TRUST_PROXY=true` is required behind Traefik so the limiter sees client IPs. |
| Compose deploy asks for a variable | Fill every `${VAR:?}` placeholder; `:?` makes them mandatory. |
