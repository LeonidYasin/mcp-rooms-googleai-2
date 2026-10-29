# Координация сессий, Оркестрация и Пул Задач (Backlog / ТЗ) для AI-Агентов

Документ предназначен для централизованной оркестрации и параллельной работы нескольких сессий AI-агентов (и людей-разработчиков) над проектом **MCP Rooms Marketplace (`LeonidYasin/mcp-rooms-googleai-2`)**.

Архитектура оркестрации и роли агентов подробно описаны в [`docs/agent_orchestration.md`](agent_orchestration.md).

---

## 📊 1. Матрица Завершённых Задач (Completed Tasks)

| Задача / Раздел | Ветка | Затронутые файлы / Модули | Ответственная сессия | Статус | Обновлено (UTC) | Коммиты / PR |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Управление PR/Issues через CLI** | `feat/mcp-cli` | `scripts/github_mcp_cli.py`, `docs/mcp_cli_instructions.md` | Сессия A (Jules) | ✅ Завершено | 2026-10-28 | `scripts/github_mcp_cli.py` |
| **Транспорт MCP JSON-RPC & SSE** | `feat/mcp-transport` | `server/mcp.ts`, `server/sse.ts` | Сессия B | ✅ Завершено | 2026-10-28 | PR #7 merged in `main` |
| **Жизненный цикл объявлений (Draft -> Preview -> Publish)** | `feat/listing-lifecycle` | `src/components/`, `server/listings.ts` | Сессия B | ✅ Завершено | 2026-10-28 | PR #7 merged in `main` |
| **Реактивный мульти-агентный чат в комнатах** | `feat/reactive-chat` | `server/negotiator.ts`, `src/components/Chat.tsx` | Сессия A (Jules) | ✅ Завершено | 2026-10-28 | PR #10 merged in `main` |
| **RBAC / Scope-based Access Control для API-ключей** | `feat/rbac-scopes` | `server/auth.ts` | Сессия A (Jules) | ✅ Завершено | 2026-10-28 | PR #11 merged in `main` |
| **Audit Logs (Трассировка действий агентов и прав)** | `feat/audit-logs` | `server/db.ts`, `server/audit.ts` | Сессия A (Jules) | ✅ Завершено | 2026-10-28 | PR #12 merged in `main` |
| **Персистентный Rate Limiting & Trust Proxy** | `feat/persistent-rate-limiter` | `server/rate_limiter.ts`, `server/index.ts` | Сессия A (Jules) | ✅ Завершено | 2026-10-29 | PR #14 merged in `main` |
| **Персистентное хранилище изображений (`/uploads`)** | `feat/image-media-storage` | `server.ts`, `server/db.ts`, `/uploads` | Сессия A (Jules) | ✅ Завершено | 2026-10-29 | PR #16 merged in `main` |
| **Технический аудит Prod-Readiness и фикс типов** | `docs/audit-and-roadmap-update-2026-10-29` | `docs/audit/2026-10-29-status-audit.md`, `server.ts`, `server/db.ts` | Сессия A (Jules) | ✅ Завершено | 2026-10-29 | PR #20 merged in `main` |
| **Оркестрация агентов и генерация пула ТЗ (Backlog)** | `feat/agent-orchestration-pool` | `docs/agent_orchestration.md`, `docs/session_coordination.md` | Architect (Jules) | 🔄 В разработке | 2026-10-29 07:15 | В текущей ветке |

---

## 🎯 2. Активный Пул Задач для Оркестрации Агентов (Task Pool & Technical Specifications)

Агенты могут автономно захватывать любую из следующих задач по **Протоколу Захвата (Task Claiming Protocol)**.

---

### 📦 TASK-01: Персистентный Event Store в SQLite для SSE и Реплей Событий (`Last-Event-ID`)

- **Роль:** Protocol & Core Agent
- **Приоритет:** Высокий (P1)
- **Затронутые файлы:** `server/db.ts`, `server/events.ts`, `server.ts`, `tests/mcp-spec-sse.test.ts`
- **ТЗ (Техническое задание):**
  1. Создать в SQLite таблицу `room_events (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, timestamp INTEGER NOT NULL)`.
  2. При вызове `roomEventBus.broadcast` или отправке сообщений сохранять событие в таблицу `room_events` с гарантированным автоинкрементным монотонным идентификатором `event-<timestamp>-<seq>`.
  3. В эндпоинте `GET /api/rooms/:id/stream` при передаче заголовка `Last-Event-ID` выбирать и отправлять клиенту все пропущенные события из `room_events`, исключая потерю или дублирование реплик при обрывах соединения.
- **Критерии приёмки:**
  - Написан тест в `tests/mcp-spec-sse.test.ts`: при сгенерированных 5 сообщениях, обрыве стрима и переподключении с `Last-Event-ID: event-...` сервер возвращает ровно пропущенные события.
  - `npm test` полностью зелёный.

---

### 📦 TASK-02: Визуализация Трассировки Вызовов MCP Инструментов в UI (`McpConsole`)

- **Роль:** Frontend & UI Agent
- **Приоритет:** Средний (P2)
- **Затронутые файлы:** `src/components/McpConsole.tsx`, `src/types.ts`
- **ТЗ (Техническое задание):**
  1. Добавить в интерфейс `McpConsole.tsx` вкладку/панель «История вызовов инструментов» (Tool Execution Log).
  2. Отображать детальное дерево параметров вызова (`inputSchema` arguments) и серверный ответ (`jsonrpc 2.0 result`) с подсветкой синтаксиса JSON.
  3. Выводить индикатор подлинности (Badge: `Authentic MCP Call via POST /mcp`) и бейдж статуса ответа (Success 200, Rate Limited 429, Unauthorized 401).
- **Критерии приёмки:**
  - Консоль загружает инструменты динамически с сервера через `tools/list` и отображает историю реальных вызовов.
  - `npm run build` проходит без ошибок TypeScript/Vite.

---

### 📦 TASK-03: Галерея Изображений в Карточке Объявления и Интеграция с `/uploads`

- **Роль:** Frontend & UI Agent
- **Приоритет:** Средний (P2)
- **Затронутые файлы:** `src/components/PublishModal.tsx`, `src/components/ListingDetail.tsx`, `src/lib/api.ts`
- **ТЗ (Техническое задание):**
  1. В форме публикации `PublishModal.tsx` подключить загрузку фото через созданный эндпоинт `POST /api/uploads` (передача base64Data).
  2. После загрузки получаемый URL вида `/uploads/img-...png` сохранять в `content.media_ids` / `photos` карточки.
  3. В карточке детализации `ListingDetail.tsx` отображать интерактивную галерею сохранённых медиафайлов.
- **Критерии приёмки:**
  - Загруженный файл корректно показывается как в предпросмотре, так и в сохранённом опубликованном объявлении.
  - `tests/media-storage.test.ts` проходит.

---

### 📦 TASK-04: Нагрузочное Тестирование и Защита от Абуза (Stress & Abuse Test Suite)

- **Роль:** QA & Abuse Agent
- **Приоритет:** Высокий (P1)
- **Затронутые файлы:** `tests/e2e-abuse.test.ts`, `server/http-guard.ts`
- **ТЗ (Техническое задание):**
  1. Расширить набор тестов `tests/e2e-abuse.test.ts` новыми кейсами:
     - Стресс-запросы 200 req/sec на публичные и защищённые эндпоинты.
     - Передача битых JSON, гигантских заголовков и спецсимволов XSS/SQLi.
     - Попытки подделки токенов авторизации и вызова чужих комнат.
  2. Убедиться, что сервер устойчиво возвращает `429 Rate Limited`, `413 Payload Too Large`, `400 Bad Request` или `403 Forbidden` без падения Node.js процесса (`uncaughtException`).
- **Критерии приёмки:**
  - Тест запускается через `npx vitest run tests/e2e-abuse.test.ts` и отдаёт 100% успехов.

---

### 📦 TASK-05: Автоматизированная Проверка Безопасных Заголовков и Strict CSP

- **Роль:** Ops & Security Agent
- **Приоритет:** Низкий (P3)
- **Затронутые файлы:** `server/http-guard.ts`, `tests/http-boundaries.test.ts`
- **ТЗ (Техническое задание):**
  1. Дополнить `securityHeaders` в `server/http-guard.ts` строгой политикой `Content-Security-Policy` (`script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `object-src 'none'`, `base-uri 'self'`).
  2. Написать юнит-тест в `tests/http-boundaries.test.ts`, проверяющий наличие всех обязательных заголовков безопасности: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- **Критерии приёмки:**
  - Тест `tests/http-boundaries.test.ts` валидирует полные HTTP заголовки.

---

### 📦 TASK-06: Продакшен Конфигурация Caddy & Deployment Automation Script

- **Роль:** Ops & Security Agent
- **Приоритет:** Средний (P2)
- **Затронутые файлы:** `Caddyfile.example`, `docker-compose.prod.yml`, `docs/deployment.md`
- **ТЗ (Техническое задание):**
  1. Создать эталонный `Caddyfile.example` с настройками Reverse Proxy, сжатием gzip/zstd, автоматическим Let's Encrypt TLS и проксированием WebSocket/SSE.
  2. Подготовить `docker-compose.prod.yml` с ограниченными ресурсами CPU/RAM, подмонтированием персистентных томов `/app/data` и логированием.
  3. Написать итоговую пошаговую инструкцию по деплою в `docs/deployment.md`.
- **Критерии приёмки:**
  - Конфигурации валидны и не содержат секретов/захардкоженных IP.

---

## 📝 3. Журнал Передачи Контекста (Handover Log)

* **2026-10-29 07:15 (Architect Agent / Jules):**
  - **Статус:** Сформирован полный активный пул задач TASK-01 ... TASK-06 с ТЗ, ролевым делением и критериями приёмки.
  - **Заметки:** Все 6 задач не перекрываются по файлам и готовы к параллельной реализации автономными сессиями агентов.
