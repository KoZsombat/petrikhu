FROM oven/bun:1.4 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/web/package.json apps/web/package.json

RUN bun install --frozen-lockfile

FROM oven/bun:1.4
WORKDIR /app

COPY --from=deps /app ./
COPY apps/api ./apps/api

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=6 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:3001/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["sh", "-c", "bun run db:migrate && bun run db:seed && bun run start"]
