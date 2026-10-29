# Running the app & VPS Deployment (Docker Compose + Caddy Option B)

This runbook covers both local Docker Compose execution and automated GitHub Actions deployment to a production VPS using Option B (isolated containers without interfering with existing host Caddy or VPN services).

## 1. Configure

```bash
cp .env.example .env
```

Only `.env.example` belongs in Git. A real `.env` with `GEMINI_API_KEY` must never be
committed, and `.dockerignore` excludes `.env` from the build context.

- Without `GEMINI_API_KEY` and `GEMINI_MODEL`, `/api/chat` and negotiation use
  rule-based fallbacks and mark responses `degraded: true` with a reason code
  (`missing_api_key`, `model_not_configured`, `invalid_api_key`, `model_error`).
  The model id is never defaulted in code. `GET /api/llm/status` reports this
  configuration and the circuit-breaker cooldown; it does not probe the model.
- `EMBEDDING_PROVIDER=disabled` uses the lexical fallback; `google` requires a key.

## 2. Prepare the data directory

The image runs as `node` (UID/GID **1000**), not root. The bind mount must be
writable by that user:

```bash
mkdir -p data
sudo chown -R 1000:1000 data
```

If the directory is owned by root, the container starts but SQLite writes fail and
`initDatabase()` reports an error. A Docker **named volume** instead of the bind
mount inherits the `node:node`, mode `700` ownership baked into the image.

## 3. Start

```bash
docker compose up -d --build
```

The service listens on `http://localhost:3000` (or `PORT` from `.env`). SQLite is stored
in `./data/mcp_rooms.db` on the host. The container gets `no-new-privileges`, all Linux
capabilities dropped, and `init: true`.

Inside the image only `/app/data` is writable by the runtime user; application code and
`node_modules` are root-owned and read-only for the process. The image contains no
`.env`, `src/`, `tests/`, or dev dependencies (`vite`, `typescript`, `vitest`).

## 4. Demo data (optional)

A fresh database is empty: no listings, no profiles. To load the fictional demo
catalogue deliberately:

```bash
docker compose exec mcp-rooms npm run seed:demo
# or set DEMO_SEED=1 in .env and restart
```

Everything seeded this way is made-up example data. Do not present it as real demand,
offers, or people, and do not enable it on a database that contains real records.
There is no production guard: `DEMO_SEED=1` adds fictional rows to whatever database
`DATABASE_PATH` points at.

## 5. Issue an API key

Writes (publication, rooms, chat, `/mcp` `tools/call`) need a bearer key:

```bash
docker compose exec mcp-rooms npm run key:issue -- --principal user:demo --name local
```

The token is printed once and stored in SQLite only as a sha256 digest. Keys have no
roles, scopes, or read audit log. Request limits are in-process and per key (see
README), not a shared quota.

## Reproducible builds

`package-lock.json` is committed and both CI and the `Dockerfile` use `npm ci`, so the
dependency graph is pinned. The image is built in four stages: `deps` (install with
native toolchain), `builder` (`tsc` + `vite build`), `prod-deps` (`npm prune
--omit=dev`), and `runner` (Alpine, `USER node`).

The server is still started with `node --import tsx server.ts`, i.e. TypeScript is
transpiled at startup; only the frontend is prebuilt into `dist/`. Removing that last
runtime transpile step is not done here.

## Automated GitHub Actions Auto-Deploy to VPS (Option B)

Option B deploys `mcp-rooms` and an isolated `caddy` container on alternate ports (default `8080:80` and `8443:443`), preventing port conflicts with any pre-existing host Caddy daemon, nginx, or VPN services.

### 1. Pre-Deployment Inspection Script

Before launching containers, run the automated health check script to verify RAM, disk space, Docker installation, and socket conflicts:

```bash
./scripts/pre-deploy-check.sh
```

### 2. GitHub Repository Secrets Setup

In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add the following secrets:

- `VPS_HOST`: IP address or domain of your VPS
- `VPS_USERNAME`: SSH username (e.g. `root` or `ubuntu`)
- `VPS_SSH_KEY`: Private SSH key for passwordless authentication
- `GEMINI_API_KEY`: API key for Google Gemini LLM & Embeddings

**Optional Secrets:**
- `HOST_PORT`: Host port mapping for Node.js app (default: `3000`)
- `CADDY_HTTP_PORT`: Port for Caddy HTTP (default: `8080`)
- `CADDY_HTTPS_PORT`: Port for Caddy HTTPS (default: `8443`)
- `SITE_ADDRESS`: Target domain name or address for Caddy (default: `:80`)

### 3. Deploying via GitHub Actions

When code is merged into `main` (or triggered manually via **Actions > Auto-Deploy to VPS**), GitHub Actions will:
1. Connect securely to your VPS via SSH.
2. Clone/pull the latest code into `~/mcp-rooms`.
3. Run `scripts/pre-deploy-check.sh` to confirm port availability and system health.
4. Launch the stack with `docker compose -f docker-compose.prod.yml up -d --build`.
5. Verify container readiness via `/healthz` endpoint.

Back up `./data/mcp_rooms.db` (and its `-wal`/`-shm` files) before any manual upgrade.
Restoring a backup as root will change file ownership — re-run `sudo chown -R 1000:1000 ./data`.
