# Running the app (Docker Compose)

This is a prototype runbook, not evidence of a deployment. The repository has a
`Dockerfile` and `docker-compose.yml`. CI job `docker` builds the image on
`ubuntu-24.04`, asserts that it runs as the unprivileged `node` user (UID 1000),
starts a container, and checks `/api/listings`, `POST /mcp` `tools/list`, and a
SQLite write through `scripts/issue-key.ts`. That covers the image contract only —
there is no live, TEST, or production deployment.

## 1. Configure

```bash
cp .env.example .env
```

Only `.env.example` belongs in Git. A real `.env` with `GEMINI_API_KEY` must never be
committed, and `.dockerignore` excludes `.env` from the build context.

- Without `GEMINI_API_KEY`, `/api/chat` and negotiation use rule-based fallbacks and
  mark responses `degraded: true`.
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

## 4. Issue an API key

Writes (publication, rooms, chat, `/mcp` `tools/call`) need a bearer key:

```bash
docker compose exec mcp-rooms npm run key:issue -- --principal user:demo --name local
```

The token is printed once and stored in SQLite only as a sha256 digest. Keys have no
roles, scopes, rate limiting, or read audit log.

## Reproducible builds

`package-lock.json` is committed and both CI and the `Dockerfile` use `npm ci`, so the
dependency graph is pinned. The image is built in four stages: `deps` (install with
native toolchain), `builder` (`tsc` + `vite build`), `prod-deps` (`npm prune
--omit=dev`), and `runner` (Alpine, `USER node`).

The server is still started with `node --import tsx server.ts`, i.e. TypeScript is
transpiled at startup; only the frontend is prebuilt into `dist/`. Removing that last
runtime transpile step is not done here.

## What this setup does not include

- TLS, a domain, or a reverse proxy (Caddy/nginx). Do not expose port 3000 to the
  internet as-is.
- A read-only root filesystem. `/app/data` must stay writable, and `npm run key:issue`
  inside the container still needs a writable `$HOME`.
- Backups, migrations, monitoring, shared rate limiting across instances (the limiter is
  per process), key scopes, or audit logs.
- A verified production or TEST environment. Green CI does not imply either.

Back up `./data/mcp_rooms.db` (and its `-wal`/`-shm` files) before any manual upgrade.
Restoring a backup as root will change file ownership — re-run the `chown` from step 2.
