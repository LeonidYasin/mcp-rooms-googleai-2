# PR-4 — identity parity: scopes, TTL, делегирование

Дата: 2026-10-28. Основание: `docs/audit/2026-10-27-audit.md` (F-01), `docs/audit/pr-plan.md` §6.
Ветка: `feat/identity-contract`, база — `main` (`06ed88f`).
Эталон контракта: `src/mcp_rooms/identity.py` и `src/mcp_rooms/server.py` исходного
`LeonidYasin/mcp-rooms` (изучены в `mcp-rooms-check`).

## Зачем

PR-3 ввёл ключи, но это была параллельная модель: без scopes, без срока жизни, без
`/identity`, без делегирования и с токеном в query-строке для SSE. Исходный проект уже
решает эти задачи, поэтому PR-4 приводит прототип к его контракту, а не изобретает новый.
Это предусловие для PR-5 (официальный MCP SDK): SDK-транспорт должен получать готового
per-request субъекта со scopes.

## Что изменилось

### Схема (`server/db.ts`)

- `users`: `id` (`user:<slug>`), `display_name`, `created_at`, `disabled`.
- `credentials`: `id` (32 hex, публичный), `user_id`, `name`, `digest` (sha256, UNIQUE),
  `resource`, `scopes_json`, `created_at`, `expires_at`, `last_used_at`, `revoked_at`.
- Функции CRUD, подсчёт ключей, `touch` с throttling, отзыв.
- Старая таблица `api_keys` остаётся нетронутой (не destructive change), но больше не
  используется: формат токена изменился, поэтому ключи PR-3 нужно перевыпустить.
  Автоматическая миграция намеренно не делается — она создавала бы иллюзию работающих
  старых токенов.

### Auth (`server/auth.ts`)

- Токен `mcr_<32 hex>.<43 base64url>`: id для O(1) поиска + секрет, сравнение digest
  через `crypto.timingSafeEqual`.
- Scopes: `rooms:read`, `rooms:write`, `listings:read`, `listings:write`; по умолчанию все.
- TTL: 7 дней по умолчанию, максимум 90, минимум 1.
- 20 ключей на пользователя (lifetime cap, как в исходнике).
- `MCP_RESOURCE` (например `https://host/mcp`) привязывает credential к ресурсу; пустое
  значение — только для локальной разработки, в production обязательно.
- Fail-closed: неизвестный/просроченный/отозванный ключ или отключённый пользователь → `401`
  `invalid_token` + `WWW-Authenticate`; ошибка хранилища → `503 authentication_unavailable`.
- `requireAuth`, `requireScope(scope)`, `optionalAuth`, `isRoomParticipant`,
  `rejectQueryString`.

### HTTP API (`server.ts`)

| Endpoint | Требование |
| --- | --- |
| `GET /api/listings*`, `GET /api/profiles*`, `GET /api/embedding/status`, `POST /api/match` | анонимно |
| `POST /api/listings` | `listings:write` |
| `GET /api/rooms`, `/api/rooms/:id`, `/stream`, `GET /api/negotiations` | `rooms:read` + участие |
| `POST /api/rooms/:id/messages`, `/api/agent/negotiate*`, `/api/chat` | `rooms:write` + участие |
| `POST /mcp` `tools/list`, `resources/read listings://all` | анонимно |
| `POST /mcp` `tools/call` | ключ + per-tool scope |
| `GET /identity` | ключ; без секрета |
| `POST /credentials` | ключ; копия не шире источника |
| `DELETE /credentials/current` | ключ; отзывает только текущий ключ |

- `GET /identity` возвращает `user_id`, `display_name`, `credential_id`,
  `credential_name`, `scopes`, `expires_at`, `resource`.
- `POST /credentials` (`{days?}`) выпускает новый токен с теми же scopes и сроком не
  больше источника; лимит ключей → `409 credential_capacity`.
- `DELETE /credentials/current` → `204`.
- Query-строки на `/mcp`, `/identity`, `/credentials` и SSE отклоняются (`400
  query_not_supported`); `?access_token=` удалён.

### MCP (`server/mcp.ts`)

- `TOOL_SCOPES`: `search_listings`/`match_listings`/`get_profile`/`get_embedding_status` →
  `listings:read`; `create_listing` → `listings:write`; `join_room`/`send_message`/
  `negotiate_agreement` → `rooms:write`; `get_room_history` → `rooms:read`.
- Аргумент `ctx` теперь `{userId, scopes}`; каждый инструмент требует аутентификации.
- Недостающий scope — ошибка в payload инструмента (`insufficient_scope` +
  `required_scope`), а не OAuth-ошибка транспорта.
- `rooms://all` требует `rooms:read` и фильтруется по участию.

### CLI (`scripts/auth-cli.ts`)

```
npm run auth -- user create --name "…" [--id user:slug]
npm run auth -- user list
npm run auth -- user disable --id user:slug
npm run auth -- key issue --user user:slug --name "…" [--scope s]… [--days N]
npm run auth -- key list [--user user:slug]
npm run auth -- key revoke <credential_id>
```

Токен печатается один раз; `key list` показывает только метаданные. Старый
`npm run key:issue` удалён.

### UI (`src/lib/api.ts`, `ApiKeyModal.tsx`, `McpChat.tsx`)

- Ключ проверяется через `GET /identity` перед сохранением; диалог показывает пользователя,
  credential id, scopes и срок действия.
- SSE переведён с `EventSource` + `?access_token=` на `fetch`-поток с заголовком
  `Authorization` (`streamSse`), с двумя повторами при временном сбое.
- `withAccessToken` удалён.

## Тесты

`tests/auth.test.ts` переписан под новый контракт:

- 401 без ключа для всех защищённых endpoint'ов (включая `/identity`, `/credentials`);
- 401 для malformed/unknown/revoked/expired/disabled;
- `tools/list` анонимно, `tools/call` — 401;
- `/identity` без секрета и с отказом на query-токен;
- ключ `rooms:read`+`listings:read`: чтение 200, запись 403, `create_listing` через MCP →
  `insufficient_scope`;
- делегирование: scopes не шире, TTL не больше, отзыв копии не отзывает источник;
- SSE: заголовок 200, query-токен 400;
- изоляция комнат, атрибуция `owner`/`sender`, чат — без регрессий.

`tests/mcp-tools.test.ts` передаёт `{userId, scopes}`; `tests/auth-helpers.ts` создаёт
пользователя и выдаёт credential.

## Осознанные отступления от исходника

1. **Principal id задаёт оператор** (`user:<slug>`), а не серверный UUID. Прототип без
   self-service enrollment; id — публичный handle, не секрет. UUID-миграция сломала бы
   существующие комнаты и listings без пользы для этого этапа.
2. **Токен `mcr_…`**, а не `rm1_…` — отдельный продукт.
3. **OAuth discovery / protected-resource metadata** не реализованы: `/mcp` не является
   OAuth resource server. Это не заявляется; PR-5 добавляет официальный SDK-транспорт и
   может добавить метаданные отдельным решением.
4. **`MCP_RESOURCE` пуст в dev** — привязка к ресурсу выключена; в production переменная
   обязательна.

## Проверка

Локально код не запускается (ограничение проекта). Evidence — GitHub Actions на SHA
ветки; заполняется после первого прогона:

- run: _будет добавлено_
- `tsc --noEmit`, `vitest run`, `vite build`, production smoke — _будут добавлены_
