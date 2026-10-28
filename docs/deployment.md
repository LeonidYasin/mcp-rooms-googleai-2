# Running the app (Docker Compose)

This is a prototype runbook, not evidence of a deployment. The repository has a
`Dockerfile` and `docker-compose.yml`, but CI currently checks typecheck, tests, build
and a local production smoke start — it does **not** build this image. Treat the first
`docker compose build` as unverified until you run it yourself.

## 1. Configure

```bash
cp .env.example .env
```

Only `.env.example` belongs in Git. A real `.env` with `GEMINI_API_KEY` must never be
committed.

- Without `GEMINI_API_KEY`, `/api/chat` and negotiation use rule-based fallbacks and
  mark responses `degraded: true`.
- `EMBEDDING_PROVIDER=disabled` uses the lexical fallback; `google` requires a key.

## 2. Start

```bash
docker compose up -d --build
```

The service listens on `http://localhost:3000` (or `PORT` from `.env`). SQLite is stored
in `./data/mcp_rooms.db` on the host through the bind mount.

## 3. Issue an API key

Writes (publication, rooms, chat, `/mcp` `tools/call`) need a bearer key:

```bash
docker compose exec mcp-rooms npm run key:issue -- --principal user:demo --name local
```

The token is printed once and stored in SQLite only as a sha256 digest.

## What this setup does not include

- TLS, a domain, or a reverse proxy (Caddy/nginx). Do not expose port 3000 to the
  internet as-is.
- Non-root container execution: the current image runs as root and uses
  `chmod 777` on `/app/data`.
- Backups, migrations, monitoring, rate limiting, key scopes, or audit logs.
- A verified production or TEST environment. Green CI does not imply either.

Back up `./data/mcp_rooms.db` (and its `-wal`/`-shm` files) before any manual upgrade.
