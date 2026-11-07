# Two images from one Dockerfile (docker-compose.yml picks the target):
#   api  - the Hono API on Bun; also serves the built admin app at /admin
#   web  - the Next.js public site on Node (the standalone output runs on Node, the most tested runtime for
#          Next.js); the only exposed port; proxies /api, /uploads, /media and /admin to the api container
ARG BUN_VERSION=1.4.4

FROM node:24-slim AS build
ARG BUN_VERSION
RUN npm install -g bun@${BUN_VERSION}
WORKDIR /app
COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
COPY apps/admin/package.json apps/admin/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile
COPY . .
# The API address is compiled into Next.js's rewrites: inside compose it is the api service.
ARG PNW_API_URL=http://api:4001
ENV PNW_API_URL=${PNW_API_URL} NEXT_TELEMETRY_DISABLED=1
RUN bun run --cwd apps/admin build && bun run --cwd apps/client build

FROM oven/bun:${BUN_VERSION}-slim AS api
WORKDIR /app
ENV NODE_ENV=production PNW_API_PORT=4001
COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/apps/admin/dist ./apps/admin/dist
USER bun
EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:4001/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bun", "apps/server/src/index.ts"]

FROM node:24-slim AS web
WORKDIR /app
ENV NODE_ENV=production PORT=4000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/apps/client/.next/standalone ./
COPY --from=build /app/apps/client/.next/static ./apps/client/.next/static
COPY --from=build /app/apps/client/public ./apps/client/public
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/client/server.js"]
