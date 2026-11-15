FROM oven/bun:1.4 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/web/package.json apps/web/package.json

RUN bun install --frozen-lockfile

FROM oven/bun:1.4 AS build
WORKDIR /app

COPY --from=deps /app ./
COPY apps/web ./apps/web

WORKDIR /app/apps/web
ARG PUBLIC_SITE_URL=http://localhost:3003
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
RUN bun run build

# Runtime dependencies only: the Astro server needs `astro`, the Node adapter and React.
FROM oven/bun:1.4 AS prod-deps
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/web/package.json apps/web/package.json

RUN bun install --frozen-lockfile --production

FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    ASTRO_NODE_AUTOSTART=disabled

COPY --from=prod-deps /app ./
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY apps/web/server.mjs ./apps/web/server.mjs

EXPOSE 4321

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4321/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "apps/web/server.mjs"]
