# Координация сессий и распределение задач для AI-Агентов (Jules / Gemini)

Документ предназначен для координации совместной параллельной работы нескольких сессий AI-агентов (и людей-разработчиков) над проектом **MCP Rooms Marketplace (`LeonidYasin/mcp-rooms-googleai-2`)**.

---

## 📊 Матрица статуса и зон ответственности

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
| **Технический аудит Prod-Readiness и фикс типов** | `docs/audit-and-roadmap-update-2026-10-29` | `docs/audit/2026-10-29-status-audit.md`, `server.ts`, `server/db.ts` | Сессия A (Jules) | ✅ Завершено | 2026-10-29 | PR #20 / PR #21 merged |

---

## 🚀 Протокол взятия задачи в работу (Task Claiming Protocol)

Перед началом выполнения новой задачи сессия **обязана**:
1. **Проверить пересечения по файлам (File Impact Analysis):**
   - Убедиться, что планируемые к изменению файлы не находятся в процессе редактирования другой активной сессией (`🔄 В разработке`).
2. **Захватить задачу (Claim Task):**
   - Открыть `docs/session_coordination.md`.
   - Изменить статус с `⏳ Бэклог` на `🔄 В разработке`.
   - Указать имя сессии, название создаваемой ветки, затронутые файлы и текущее время UTC.
   - Закоммитить и слить/отправить изменение в координационную документацию.
3. **Правило TTL неактивности (Stale Task Timeout = 2 часа):**
   - Если задача находится в статусе `🔄 В разработке` без обновлений более **2 часов**, она считается брошенной (Stale Task).
   - Другая сессия имеет право сбросить статус на `⏳ Бэклог` или перехватить задачу, оставив запись в журнале передачи контекста.

---

## 📝 Журнал передачи контекста и блокеров (Handover & Blockers Log)

* **2026-10-29 07:00 (Сессия A / Jules):**
  - **Статус:** Проведён повторный аудит готовности к продакшену (~88-90% RC1).
  - **Заметки:** Добавлен отчёт `docs/audit/2026-10-29-status-audit.md`. Устранены ошибки типов TypeScript при сборке. Разрешены гитовые конфликты координации.
