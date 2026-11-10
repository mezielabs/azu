# syntax=docker/dockerfile:1

# The public demo at demo.azuadmin.com, on Postgres. Build from the
# repository root, since the demo uses the workspace's packages:
#
#   docker build -f apps/demo/Dockerfile -t azu-demo .
#
# Settings and the hourly reset are in apps/demo/DEPLOY.md. The image
# holds no secrets: APP_KEY and the database settings come from the host.

ARG NODE_VERSION=24.21.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN npm install --global pnpm@11.25.0

# Install, build Azu's packages, then the demo
FROM base AS build
# For native modules (better-sqlite3) without a prebuilt binary
RUN apt-get update \
  && apt-get install --yes --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
# Download every dependency from the lockfile alone, so this layer stays
# cached until pnpm-lock.yaml changes
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "demo..."
RUN pnpm --filter "./packages/*" run build
# Ace validates the environment before it builds, so it gets a throwaway
# .env with a random key; the build output doesn't include it
RUN cd apps/demo \
  && cp .env.example .env \
  && node ace generate:key \
  && node ace build \
  && rm .env
# The demo's production dependencies, with Azu's packages copied in
RUN pnpm --filter demo deploy --prod --legacy /prod/demo

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3333 \
  TZ=UTC \
  LOG_LEVEL=info \
  DRIVE_DISK=fs \
  DB_CONNECTION=pg \
  SESSION_DRIVER=cookie
WORKDIR /app
COPY --from=build --chown=node:node /prod/demo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/demo/build ./build
# Uploads (the Drive "fs" disk). Mount a volume here to keep them across
# deploys; `node ace demo:reset` empties it every hour either way.
RUN mkdir -p build/storage build/tmp && chown -R node:node build/storage build/tmp
# Coolify's health check runs curl (or wget) inside the container, and the
# slim image has neither
RUN apt-get update \
  && apt-get install --yes --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
USER node
WORKDIR /app/build
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3333) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "bin/server.js"]
