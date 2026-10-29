# Координация сессий и распределение задач для AI-Агентов (Jules / Gemini)

<<<<<<< HEAD
Документ предназначен для централизованной оркестрации и параллельной работы нескольких сессий AI-агентов (и людей-разработчиков) над проектом **MCP Rooms Marketplace (`LeonidYasin/mcp-rooms-googleai-2`)**.

Архитектура оркестрации и роли агентов подробно описаны в [`docs/agent_orchestration.md`](agent_orchestration.md).
=======
Документ предназначен для координации совместной параллельной работы нескольких сессий AI-агентов над проектом **MCP Rooms Marketplace (`LeonidYasin/mcp-rooms-googleai-2`)**.
>>>>>>> 976a10427b45ba4e812295b3730ce9bdf48eb174

---

## 🚦 Текущий статус и разделение зон ответственности

<<<<<<< HEAD
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
| **Ticket-based SSE Auth & Stream Security** | `feat/sse-ticket-auth-clean` | `server.ts`, `server/auth.ts`, `tests/sse-ticket-auth.test.ts` | Сессия A (Jules) | ✅ Завершено | 2026-10-29 | PR #25 merged in `main` |
| **Оркестрация агентов и пул задач в GitHub Issues** | `feat/agent-orchestration-pool` | `docs/agent_orchestration.md`, `docs/session_coordination.md` | Architect (Jules) | 🔄 В разработке | 2026-10-29 07:45 | В текущей ветке (PR #26) |
=======
| Задача / Раздел | Ответственная сессия | Статус | Коммиты / PR |
| :--- | :--- | :--- | :--- |
| **Управление PR/Issues через CLI** | Сессия A (Jules) | ✅ Завершено | `scripts/github_mcp_cli.py`, `docs/mcp_cli_instructions.md` |
| **Транспорт MCP JSON-RPC & SSE** | Сессия B | ✅ Завершено (PR #7) | PR #7 merged in `main` |
| **Жизненный цикл объявлений (Draft -> Preview -> Publish)** | Сессия B | ✅ Завершено (PR #7) | PR #7 merged in `main` |
| **Реактивный мульти-агентный чат в комнатах** | Сессия A (Jules) | ✅ Завершено (PR #10) | PR #10 merged in `main` (`server/negotiator.ts`) |
| **RBAC / Scope-based Access Control для API-ключей** | Сессия A (Jules) | ✅ Завершено (PR #11) | PR #11 merged in `main` (`server/auth.ts`) |
| **Audit Logs (Трассировка действий агентов и прав)** | Сессия A (Jules) | ✅ Завершено (PR #12) | PR #12 merged in `main` (`server/db.ts`) |
| **Персистентный Rate Limiting & Trust Proxy** | Сессия A (Jules) | ✅ Завершено (PR #14) | PR #14 merged in `main` (`server/http-guard.ts`) |
| **Персистентное хранилище изображений (`/uploads`)** | Сессия A (Jules) | ✅ Завершено (PR #16) | PR #16 merged in `server.ts`) |
| **Ticket-based SSE Auth & Stream Security** | Сессия A (Jules) | ✅ Завершено (PR #25) | PR #25 merged in `main` (`server/auth.ts`) |
| **Caddy / Reverse Proxy Config & TLS** | Сессия A (Jules) | 🔄 В разработке | `feat/caddy-tls-production-config` |
| **Playwright Headless E2E Tests** | Сессия B (Рекомендуется) | ⏳ Ожидает | Добавление E2E на фронтенд React |
>>>>>>> 976a10427b45ba4e812295b3730ce9bdf48eb174

---

## 🤝 Правила совместной работы

<<<<<<< HEAD
Все задачи созданы в **GitHub Issues** репозитория (#30–#35) для оперативного трекинга.  
Агенты могут просматривать и управлять задачами через CLI:
```bash
# Список открытых задач (Issues)
python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 issues list --state open
```
=======
1. **Создание веток:**
   - Всегда создавайте новую отдельную ветку для задачи: `feat/<название-задачи>` или `fix/<описание>`.
   - Именуйте ветки явно, чтобы не затирать работу соседней сессии.
>>>>>>> 976a10427b45ba4e812295b3730ce9bdf48eb174

2. **Запуск тестов перед PR:**
   - Обязательно проверяйте прохождение всех тестов через `npm test` (в проекте используются `vitest`).

<<<<<<< HEAD
### 📦 TASK-01 (Issue #30): Персистентный Event Store в SQLite для SSE и Реплей Событий (`Last-Event-ID`)

- **Issue:** [#30](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/30)
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

### 📦 TASK-02 (Issue #31): Визуализация Трассировки Вызовов MCP Инструментов в UI (`McpConsole`)

- **Issue:** [#31](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/31)
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

### 📦 TASK-03 (Issue #32): Галерея Изображений в Карточке Объявления и Интеграция с `/uploads`

- **Issue:** [#32](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/32)
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

### 📦 TASK-04 (Issue #33): Нагрузочное Тестирование и Защита от Абуза (Stress & Abuse Test Suite)

- **Issue:** [#33](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/33)
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

### 📦 TASK-05 (Issue #34): Автоматизированная Проверка Безопасных Заголовков и Strict CSP

- **Issue:** [#34](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/34)
- **Роль:** Ops & Security Agent
- **Приоритет:** Низкий (P3)
- **Затронутые файлы:** `server/http-guard.ts`, `tests/http-boundaries.test.ts`
- **ТЗ (Техническое задание):**
  1. Дополнить `securityHeaders` в `server/http-guard.ts` строгой политикой `Content-Security-Policy` (`script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `object-src 'none'`, `base-uri 'self'`).
  2. Написать юнит-тест в `tests/http-boundaries.test.ts`, проверяющий наличие всех обязательных заголовков безопасности: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- **Критерии приёмки:**
  - Тест `tests/http-boundaries.test.ts` валидирует полные HTTP заголовки.

---

### 📦 TASK-06 (Issue #35): Продакшен Конфигурация Caddy & Deployment Automation Script

- **Issue:** [#35](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/35)
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

* **2026-10-29 07:45 (Architect Agent / Jules):**
  - **Статус:** Интегрированы GitHub Issues (#30–#35) для TASK-01 ... TASK-06.
  - **Заметки:** Все 6 задач полностью задокументированы как в репо, так и в открытых GitHub Issues, и готовы к автономному исполнению.
=======
3. **Создание и слияние PR:**
   - Используйте инструмент `scripts/github_mcp_cli.py` для создания PR:
     ```bash
     GITHUB_TOKEN="$TOKEN" python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 prs create --title "..." --head <branch> --base main --body "..."
     ```
   - Если тесты CI проходят, PR можно сливать командой `prs merge --number <PR_NUM>`.

4. **Обновление этого документа (`docs/session_coordination.md`):**
   - В завершение работы по каждой задаче отмечайте статус `✅ Завершено` в таблице выше, чтобы параллельная сессия всегда видела актуальный прогресс!
>>>>>>> 976a10427b45ba4e812295b3730ce9bdf48eb174
