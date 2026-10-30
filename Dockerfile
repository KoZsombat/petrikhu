# Egy folyamat, egy port: az Express szerver kiszolgálja az API-t, a médiát és a buildelt oldalt (Cloudflare Tunnelhez is ez kell).
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
# A better-sqlite3 (csak az egyszeri importhoz kell) itt, a build fázisban nem szükséges: kihagyjuk a telepítő szkriptjét.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:24-slim AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
# The built-in page titles/intros, for the Open Graph tags the server injects (server/lib/page-meta.ts).
COPY src/pages/samples ./src/pages/samples
# Nem root felhasználóval fut.
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PNW_PORT||4000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--experimental-strip-types", "server/index.ts"]
