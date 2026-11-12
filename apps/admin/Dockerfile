FROM oven/bun:1.4 AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/web/package.json apps/web/package.json

RUN bun install --frozen-lockfile

COPY apps/admin ./apps/admin

WORKDIR /app/apps/admin
ARG VITE_API_URL=http://localhost:3001
ARG VITE_WEB_URL=http://localhost:3003
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WEB_URL=$VITE_WEB_URL

RUN bun run build

FROM nginx:alpine
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 80
