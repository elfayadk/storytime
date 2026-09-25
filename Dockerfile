# ── Storytime v2 - single-image build (core + server + web) ──────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app

# System deps for better-sqlite3 native build.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm install

COPY . .
RUN npm run build

# ── Runtime image ────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV WEB_DIST=/app/apps/web/dist
ENV STORYTIME_DB=/data/storytime.db

# Copy only what runtime needs.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/core/package.json ./packages/core/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/web/dist ./apps/web/dist

VOLUME /data
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
