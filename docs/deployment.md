# Production Deployment Guide: MCP Rooms Marketplace

This guide outlines the steps and options for deploying the MCP Rooms Marketplace service in production using Docker Compose and Caddy with automatic TLS encryption.

---

## 📋 Prerequisites

1. **Host Environment:** Linux Server (Ubuntu 22.04 / 24.04 LTS recommended) with Docker (`>= 24.0`) and Docker Compose (`>= v2.20`).
2. **Domain Name:** A public domain pointing A/AAAA DNS records to the server's public IP address.
3. **Ports:** Public TCP ports `80` (HTTP) and `443` (HTTPS) open on system firewall.

---

## ⚡ Existing Host Caddy / Nginx Co-existence Guide

If your VPS already runs a system **Caddy** or **Nginx** process binding TCP ports `80` and `443`:

### Integration with Existing Host Caddy (`/etc/caddy/Caddyfile`)

Append this site block to your host `/etc/caddy/Caddyfile`:

```caddy
leonid-mcp.duckdns.org {
	encode zstd gzip

	# Unbuffered SSE streaming for real-time room chats
	@sse path /api/rooms/*/stream
	handle @sse {
		reverse_proxy 127.0.0.1:3000 {
			flush_interval -1
		}
	}

	# Reverse proxy all standard API and static frontend traffic
	handle {
		reverse_proxy 127.0.0.1:3000
	}
}
```

Reload host Caddy:
```bash
sudo systemctl reload caddy
```

---

## 🚀 Deployment Options (Варианты развёртывания)

### 🌟 Option 1: One-Command Automated Deployment (Самый простой способ — 1 клик)

Connect to your VPS via SSH and run this single command:

```bash
git clone https://github.com/LeonidYasin/mcp-rooms-googleai-2.git /opt/mcp-rooms && \
cd /opt/mcp-rooms && \
mkdir -p ./data/uploads ./data/thumbnails && \
sudo chown -R 1000:1000 ./data && \
cp .env.example .env && \
docker compose -f docker-compose.prod.yml up -d --build
```

**What this command does automatically:**
1. Clones the latest production code into `/opt/mcp-rooms`.
2. Creates SQLite database and media upload directories with proper non-root UID 1000 container permissions.
3. Copies `.env.example` to `.env`.
4. Builds and starts the production container stack (`Express + SQLite + Caddy Reverse Proxy`).
5. Caddy automatically provisions and renews free Let's Encrypt TLS certificates.

---

### 🤖 Option 2: Autonomous Agent Deployment via SSH (Автономный деплой через ИИ-агента)

If you grant SSH access (IP, user, password/key) to the AI Agent session:
1. The agent connects directly to your target VPS over SSH.
2. Creates `/opt/mcp-rooms` directories and writes custom `.env` secrets (`DOMAIN`, `LETSENCRYPT_EMAIL`, `GEMINI_API_KEY`).
3. Executes `docker compose -f docker-compose.prod.yml up -d --build`.
4. Runs health checks against `https://<your-domain>/api/health` and verifies 200 OK status.

*(Security Note: Rotate temporary SSH passwords/keys after deployment completes).*

---

### 🔄 Option 3: Continuous Integration & Delivery (CI/CD via GitHub Actions)

For automated zero-downtime updates on every `git push` to `main`:

1. Store the following GitHub Repository Secrets (`Settings -> Secrets and variables -> Actions`):
   - `VPS_HOST`: Public IP or domain of your server.
   - `VPS_USERNAME`: SSH username (e.g. `root` or `deploy`).
   - `VPS_SSH_KEY`: Private SSH key for server access.

2. Create workflow file `.github/workflows/deploy.yml`:

```yaml
name: Continuous Deployment

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to VPS over SSH
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USERNAME }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/mcp-rooms
            git pull origin main
            docker compose -f docker-compose.prod.yml up -d --build
```

---

## ⚙️ Manual Step-by-Step Instructions

### 1. Clone Repository & Setup Directories

```bash
git clone https://github.com/LeonidYasin/mcp-rooms-googleai-2.git /opt/mcp-rooms
cd /opt/mcp-rooms

# Create persistent storage directories and assign permissions (UID 1000 for non-root container)
mkdir -p ./data/uploads ./data/thumbnails
sudo chown -R 1000:1000 ./data
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in required values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DOMAIN=mcp-rooms.yourdomain.com
LETSENCRYPT_EMAIL=admin@yourdomain.com
GEMINI_API_KEY=your_production_gemini_api_key
EMBEDDING_PROVIDER=google
EMBEDDING_MODEL=text-embedding-004
GEMINI_MODEL=gemini-1.5-flash
```

### 3. Build & Launch Containers

Start the production stack using Docker Compose:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Verify System Health

Verify container statuses and health check endpoint:

```bash
docker compose -f docker-compose.prod.yml ps
curl -i https://mcp-rooms.yourdomain.com/api/health
```

Expected output includes HTTP status `200 OK` and JSON status payload:

```json
{
  "status": "ok",
  "uptime": 12.34,
  "database": {
    "status": "connected",
    "path": "/app/data/mcp_rooms.db"
  },
  "memory": {
    "rss": 12345678,
    "heapUsed": 1234567,
    "heapTotal": 12345678
  }
}
```

---

## 🛡️ Reverse Proxy & Traffic Routing

The setup includes **Caddy Proxy** as an edge reverse proxy providing:
- Automatic Let's Encrypt / ZeroSSL TLS certificates.
- HTTP/2 and HTTP/3 support.
- Automatic compression (`gzip`, `zstd`).
- `flush_interval -1` unbuffered proxying for Server-Sent Events (SSE) `/api/rooms/*/stream` streams.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`).

---

## 📊 Container Resource & Maintenance Guidelines

- **CPU Limit:** 2.0 cores.
- **RAM Limit:** 1024 MB.
- **Log Rotation:** JSON logs capped at 10MB per file with maximum 3 backup files.
- **Backups:** Schedule daily backup of SQLite database file at `./data/mcp_rooms.db` and `./uploads/`.

```bash
# Example backup command
sqlite3 ./data/mcp_rooms.db ".backup './data/mcp_rooms_backup_$(date +%Y%m%d).db'"
```
