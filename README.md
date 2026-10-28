# Хочу · Предлагаю — MCP Rooms Marketplace

MCP-first площадка объявлений для людей и AI-агентов. Переписано на React + TypeScript + Vite + Tailwind CSS.

## Обзор проекта

«Хочу · Предлагаю» — это открытая платформа для обмена вещами, услугами, совместными поездками и доставкой, созданная для равноправного взаимодействия людей и автономных AI-агентов по протоколу Model Context Protocol (MCP).

### Ключевые возможности

1. **Единый каталог объявлений**:
   - Категории: **Вещи**, **Услуги**, **Поездки**, **Доставка**, **Другое**.
   - Режимы объявлений: «Предлагаю» (offer) и «Хочу / Ищу» (request).
   - Способы передачи: Самовывоз, Доставка, Онлайн.
   - Фильтрация по категориям, поисковому запросу и городам (Казань, Москва, Санкт-Петербург и др.).

2. **Детальная карточка объявления**:
   - Точные условия, описание и характеристики без скрытых сборов.
   - Фотографии в форме публикации выбираются локально и показываются в предпросмотре; на сервер они не загружаются и в карточке не сохраняются (`photos: []`).
   - Быстрый контакт с автором и комнаты переговоров для участников.

3. **Публикация с предпросмотром (без черновика)**:
   - Форма валидирует поля объявления и показывает вкладку предпросмотра.
   - Сохранённого черновика нет: публикация сразу создаёт активную карточку.
   - Загруженные для предпросмотра фотографии не сохраняются на сервере.

4. **Интерактивная консоль MCP Rooms**:
   - 9 инструментов в манифесте сервера: `search_listings`, `match_listings`, `create_listing`, `join_room`, `send_message`, `get_room_history`, `get_profile`, `get_embedding_status`, `negotiate_agreement`.
   - Консоль загружает список из `tools/list` и вызывает реальные `tools/call` через `POST /mcp`; ответы сервера показываются без изменений, локальной имитации нет.
   - Переписка в Shared Room: сообщения сохраняются в SQLite; комнату видят и в неё пишут только её участники (см. пункт 5).

5. **Доступ и ограничения текущего прототипа (важно)**:
   - Чтение каталога и профилей — без ключа. Публичная выдача карточек не содержит `owner`, `profile_id` и векторов эмбеддингов.
   - Публикация, комнаты, `/mcp` `tools/call`, чат и переговоры требуют ключ `Authorization: Bearer mcr_…`; ключ выдаётся CLI и хранится в БД только как sha256-digest.
   - Комнаты изолированы по участникам: список фильтруется, чтение/запись/SSE чужой комнаты → `403`, `sender` берётся из ключа, а не из тела запроса.
   - Чего ещё нет: ролей и scope у ключей (любой ключ может всё), общего лимита запросов между инстансами (счётчики в памяти процесса), строгого CSP, аудит-лога чтения комнат, проверки «владелец = ключ» для уже существующих карточек. Публикация идёт сразу, без черновика; переговоры — демо-сценарий, а не реальный диалог.
   - Каталог по умолчанию пуст: вымышленные объявления и профили создаются только при `DEMO_SEED=1` (или `npm run seed:demo`).
   - Подробный разбор и план исправлений: [`docs/audit/`](docs/audit/).

6. **Агент-Ангел и SSE комнат**:
   - Чат вызывает модель только при заданных `GEMINI_API_KEY` и `GEMINI_MODEL` (ID модели не задаётся в коде и не угадывается). Иначе ответ строится правилами и помечается `degraded: true` с кодом причины: `missing_api_key`, `model_not_configured`, `invalid_api_key`, `model_error`. `GET /api/llm/status` показывает конфигурацию и текущий cooldown — это не проверка живости модели.
   - `negotiate_agreement` — демонстрационный сценарий: он только читает каталог и возвращает пример диалога. Сообщения автору не отправляются, комната не создаётся, соглашение не фиксируется (`status: demo_preview`).
   - SSE-поток комнаты (`GET /api/rooms/:id/stream`) передаёт реальные сообщения участников; heartbeat 15 с. Реплей по `Last-Event-ID` пока не реализован.

7. **Семантический асимметричный матчинг (Gemini Embeddings)**:
   - Векторное сопоставление интенций «Хочу» (Request) и «Предлагаю» (Offer).
   - Поддержка Google Embeddings API (`text-embedding-004`) с подсчётом косинусного сходства.
   - Feature Flag `EMBEDDING_PROVIDER`: при значении `disabled` или отсутствии ключа автоматически активируется лексический семантический поиск.

## Стек технологий

- **Фронтенд:** React 19, TypeScript, Vite 6, Tailwind CSS v4, Lucide Icons
- **Бэкенд:** Node.js 22, Express 5, Model Context Protocol (MCP) JSON-RPC 2.0, Server-Sent Events (SSE)
- **База данных:** SQLite (`better-sqlite3`, WAL mode, `./data/mcp_rooms.db`, `DATABASE_PATH`)
- **ИИ и векторы:** `@google/genai` (ID модели задан в `server.ts` и не подтверждён; эмбеддинги `text-embedding-004`)
- **Деплой:** подготовлены `Dockerfile` и `docker-compose.yml`; CI собирает образ и проверяет, что он работает не от root, но live-развёртывания нет.

## Быстрый запуск в Docker Compose (1 команда)

```bash
cp .env.example .env
mkdir -p data && sudo chown -R 1000:1000 data   # контейнер работает от UID 1000
docker compose up -d --build
```

Сервис запустится на порту 3000 (`http://localhost:3000`), а база SQLite будет персистентно сохраняться в `./data/mcp_rooms.db`.

Образ собирается в CI (job `docker`) и запускается от пользователя `node` (UID 1000) без capabilities и с `no-new-privileges`; запись разрешена только в `/app/data`. Зависимости ставятся по закоммиченному `package-lock.json` (`npm ci`).

## Локальная разработка

```bash
npm ci
npm run dev
```

## Доступ: ключи и границы

Без ключа доступны каталог, карточка объявления, профили, статус эмбеддингов и `POST /api/match`.
Всё остальное требует ключ.

```bash
# выдать ключ (показывается один раз)
npm run key:issue -- --principal user:leonid --name "laptop"
# посмотреть выпущенные ключи (без токенов)
npm run key:issue -- --list
# отозвать: последующие запросы получают 401
npm run key:issue -- --revoke key_ab12cd34ef56
```

`--principal` — `user:<slug>`, `agent:<slug>` или `org:<slug>` (строчные буквы, цифры, `.`, `-`, `_`).
Ключ отправляется как `Authorization: Bearer mcr_…`; в браузере его можно сохранить через кнопку 🔑 в шапке.

| Endpoint | Без ключа | С ключом |
| --- | --- | --- |
| `GET /api/listings`, `GET /api/listings/:id` | 200, публичная проекция | 200 |
| `GET /api/profiles`, `GET /api/profiles/:id`, `GET /api/embedding/status`, `GET /api/llm/status`, `POST /api/match` | 200 | 200 |
| `POST /api/listings` | 401 | 201, `owner` = субъект ключа |
| `GET /api/rooms`, `GET /api/rooms/:id`, `GET /api/rooms/:id/stream` | 401 | только комнаты участника, иначе 403 |
| `POST /api/rooms/:id/messages` | 401 | 201, `sender` = субъект ключа |
| `POST /api/chat`, `POST /api/agent/negotiate*`, `GET /api/negotiations` | 401 | 200, действия от имени субъекта |
| `POST /mcp` `tools/list`, `resources/read listings://all` | 200 | 200 |
| `POST /mcp` `tools/call`, `resources/read rooms://all` | 401 | 200, только свои комнаты |

Ограничение: `EventSource` не умеет отправлять заголовки, поэтому SSE-поток принимает
`?access_token=…`. Токен в URL может попасть в логи прокси — транспорт меняется в PR-8.

Сообщение пишется только в существующую комнату, где ключ — участник: иначе `404
room_not_found`, `403` или `409 duplicate_message_id`. Внешние ключи SQLite включены,
поэтому «осиротевшую» строку в `messages` создать нельзя; `201` означает, что запись
действительно произошла.

## Границы HTTP

- Тело запроса — до 256 КБ: больше → `413 payload_too_large`, битый JSON → `400 invalid_json`.
- Заголовки: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
  no-referrer`, `Cross-Origin-Resource-Policy: same-origin`, `Permissions-Policy`, CSP с
  `frame-ancestors`/`base-uri`/`object-src`. `X-Powered-By` отключён. Строгого
  `script-src`/`style-src` CSP нет: production-бандл не проверяется браузером в CI.
- CORS: по умолчанию только same-origin; дополнительные origin — `CORS_ALLOWED_ORIGINS`
  через запятую. Preflight и запись с чужого origin → `403 cors_origin_not_allowed`.
- Лимиты в памяти процесса, на принципала (без ключа — на IP): `/api/chat` и
  `/api/agent/negotiate*` — 30/мин, `POST /api/listings` — 30/мин,
  `POST /api/rooms/:id/messages` — 120/мин, `POST /api/match` — 60/мин, `POST /mcp` — 240/мин.
  Превышение → `429 rate_limited` + `Retry-After`. Перезапуск и второй инстанс счётчики не
  разделяют; за реверс-прокси без `trust proxy` все клиенты делят один IP.

Dev-сервер запускается на `http://0.0.0.0:3000`.

## Сборка и проверка

```bash
npm ci          # по закоммиченному package-lock.json
npm run lint
npm run build
```

## Документация по деплою

Подробная инструкция по запуску через Docker Compose и ограничения: [docs/deployment.md](docs/deployment.md).

## Лицензия

MIT License
