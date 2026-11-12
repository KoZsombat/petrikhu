FROM oven/bun:1.4 AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/web/package.json apps/web/package.json

RUN bun install --frozen-lockfile

COPY apps/web ./apps/web

WORKDIR /app/apps/web
ARG PUBLIC_SITE_URL=http://localhost:3003
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
RUN bun run build

FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web ./apps/web

EXPOSE 4321
CMD ["node", "apps/web/dist/server/entry.mjs"]
