# Инструкция по деплою MCP ROOMS на Ubuntu VPS

Этот проект спроектирован для надежного развертывания на любом сервере Ubuntu VPS (20.04 / 22.04 / 24.04 LTS) с постоянным хранилищем SQLite на диске и поддержкой Model Context Protocol (MCP).

---

## Вариант 1: Быстрый запуск в Docker Compose (Рекомендуемый, 1 команда)

### 1. Клонирование и настройка
```bash
git clone https://github.com/LeonidYasin/mcp-rooms.git
cd mcp-rooms
cp .env.example .env
```

### 2. Конфигурация (.env)
Отредактируйте `.env`:
```ini
PORT=3000
NODE_ENV=production

# Эмбеддинги: 'google' (с ключом) или 'disabled' (для автономного локального fallback)
EMBEDDING_PROVIDER=google
EMBEDDING_MODEL=text-embedding-004
GEMINI_API_KEY=ваш_ключ_google_gemini_api
```

### 3. Запуск одной командой
```bash
docker compose up -d --build
```

Сервер запустится на порту `3000`. Все данные базы SQLite автоматически сохраняются в хостовой директории `./data/mcp_rooms.db`.

Проверка статуса:
```bash
docker compose ps
docker compose logs -f
```

---

## Вариант 2: Запуск через Node.js 22 + PM2 / Systemd

### 1. Установка Node.js 22 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
sudo npm install -g pm2
```

### 2. Сборка и запуск
```bash
cd /opt/mcp-rooms
npm install
npm run build
pm2 start server.ts --name "mcp-rooms" --interpreter tsx
pm2 save
pm2 startup
```

---

## Настройка Caddy (Reverse Proxy & автоматический SSL)

Установите Caddy:
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

Конфигурация `/etc/caddy/Caddyfile`:
```caddy
yourdomain.com {
    reverse_proxy localhost:3000
}
```

Перезапустите Caddy:
```bash
sudo systemctl reload caddy
```

---

## Проверка эндпоинтов

- **Веб-интерфейс каталога и чата:** `https://yourdomain.com/`
- **MCP JSON-RPC 2.0 сервер:** `https://yourdomain.com/mcp`
- **Статус эмбеддингов:** `https://yourdomain.com/api/embedding/status`
- **Семантический асимметричный матчинг:** `POST https://yourdomain.com/api/match`
- **Профили пользователей/компаний:** `https://yourdomain.com/api/profiles`
