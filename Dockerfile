# =============================================================
# MCP ROOMS — multi-stage image
#
#   deps      reproducible `npm ci` (includes the toolchain for better-sqlite3)
#   builder   TypeScript + Vite production build
#   prod-deps runtime dependencies only (build/test tooling pruned)
#   runner    Alpine runtime, unprivileged `node` user (UID/GID 1000)
#
# Only /app/data is writable by the runtime user. Everything else in the
# image is root-owned and must stay read-only for the process.
# CI builds this image and asserts the non-root contract —
# see `.github/workflows/ci.yml` (job `docker`).
# =============================================================

FROM node:22-alpine AS deps

WORKDIR /app

# better-sqlite3 falls back to a source build when no musl prebuild matches.
RUN apk add --no-cache python3 make g++ sqlite-dev

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# =============================================================
# Build stage: frontend bundle (dist/) + typecheck
# =============================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# =============================================================
# Runtime dependencies only
# =============================================================
FROM node:22-alpine AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules

# Prune instead of reinstalling so the native better-sqlite3 binary that was
# compiled against musl in `deps` is reused.
RUN npm prune --omit=dev --no-audit --no-fund \
  && npm cache clean --force

# =============================================================
# Production image
# =============================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/app/data/mcp_rooms.db

# Runtime shared library for better-sqlite3.
RUN apk add --no-cache sqlite-libs

# Application code and dependencies stay root-owned: the runtime user cannot
# modify them. `--chown` is deliberately absent.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY server.ts ./
COPY server ./server
COPY scripts ./scripts
COPY --from=builder /app/dist ./dist

# The only writable path for the runtime user. A fresh named volume inherits
# this ownership; a bind mount must be chowned to 1000:1000 on the host.
RUN mkdir -p /app/data && chown node:node /app/data && chmod 700 /app/data

VOLUME ["/app/data"]

USER node

EXPOSE 3000

# Healthcheck to verify Express server and MCP endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/listings || exit 1

# `node --import tsx` keeps the server as PID 1 so it receives signals directly.
CMD ["node", "--import", "tsx", "server.ts"]
