# =============================================================
# Multi-stage Dockerfile for MCP ROOMS on Ubuntu VPS
# Persistent SQLite + Full-stack Vite/Express + MCP Protocol
# =============================================================

FROM node:22-alpine AS builder

WORKDIR /app

# Install native dependencies required for better-sqlite3 compilation
RUN apk add --no-cache python3 make g++ sqlite-dev

# Install npm dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code and configuration
COPY . .

# Build frontend and compile TypeScript
RUN npm run build

# =============================================================
# Production Image
# =============================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache sqlite-libs

# Copy application artifacts from builder
COPY --from=builder /app /app

# Ensure persistent SQLite data directory exists
RUN mkdir -p /app/data && chmod 777 /app/data

# Persistent data volume for SQLite database
VOLUME ["/app/data"]

EXPOSE 3000

# Healthcheck to verify Express server and MCP endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/listings || exit 1

CMD ["npm", "run", "start"]
