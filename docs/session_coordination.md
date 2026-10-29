# Координация сессий и распределение задач для AI-Агентов (Jules / Gemini)

Документ предназначен для координации совместной параллельной работы нескольких сессий AI-агентов над проектом **MCP Rooms Marketplace (`LeonidYasin/mcp-rooms-googleai-2`)**.

---

## 🚦 Текущий статус и синхронизированный пул задач (Issues & PR Matrix)

| Задача / Модуль | Связанное Issue | Ветка / PR | Ответственная сессия | Статус |
| :--- | :--- | :--- | :--- | :--- |
| **Управление PR/Issues через CLI** | Issue #1 | PR #1 (merged) | Сессия A (Jules) | ✅ Завершено |
| **Транспорт MCP JSON-RPC & SSE** | Issue #7 | PR #7 (merged) | Сессия B | ✅ Завершено |
| **Жизненный цикл объявлений (Draft -> Preview -> Publish)** | Issue #7 | PR #7 (merged) | Сессия B | ✅ Завершено |
| **Реактивный мульти-агентный чат в комнатах** | Issue #10 | PR #10 (merged) | Сессия A (Jules) | ✅ Завершено |
| **RBAC / Scope-based Access Control для API-ключей** | Issue #11 | PR #11 (merged) | Сессия A (Jules) | ✅ Завершено |
| **Audit Logs (Трассировка действий агентов)** | Issue #12 | PR #12 (merged) | Сессия A (Jules) | ✅ Завершено |
| **Персистентный Rate Limiting & Trust Proxy** | Issue #14 | PR #14 (merged) | Сессия A (Jules) | ✅ Завершено |
| **Персистентное хранилище изображений (`/uploads`)** | Issue #16 | PR #16 (merged) | Сессия A (Jules) | ✅ Завершено |
| **Ticket-based SSE Auth & Stream Security** | Issue #25 | PR #25 (merged) | Сессия A (Jules) | ✅ Завершено |
| **Caddy / Reverse Proxy Config & TLS** | Issue #29 | PR #29 (merged) | Сессия A (Jules) | ✅ Завершено |
| **Playwright Headless E2E Tests** | Issue #30 | `feat/playwright-e2e` | Сессия B (Параллельная) | ⏳ Ожидает / Backlog |
| **SSE Replay & Last-Event-ID** | Issue #31 | `feat/sse-last-event-id` | Сессия A/B | ⏳ Ожидает / Backlog |
| **Мульти-модельные переговоры (Claude/OpenAI)** | Issue #32 | `feat/multi-model-negotiation` | Сессия A/B | ⏳ Ожидает / Backlog |
| **Строгая CSP & Security Headers** | Issue #33 | `feat/csp-security-headers` | Сессия C | ⏳ Ожидает / Backlog |
| **Деплой на боевой VPS (TLS + Domain)** | Issue #34 | `ops/vps-live-deploy` | Ops / CTO | 🛑 Одобрение владельца |

---

## 🤝 Протокол синхронизации Пула Задач ↔ Issues ↔ PR

Для поддержания 100% актуальности между текстовыми роадмапами и GitHub Issues/PRs применяется следующий алгоритм:

1. **Единый источник правды:**
   - Каждая задача из роадмапов (`docs/roadmap.md`, `docs/final_production_roadmap.md`) связывается с отдельным GitHub Issue (`#Issue_ID`).
2. **Создание ветки и PR:**
   - Ветка именуется по номеру Issue или фичи: `feat/issue-30-playwright-e2e` или `feat/caddy-tls-production-config`.
   - В теле PR и в коммитах обязательно указывается связь с Issue: `Closes #30` или `Fixes #29`.
3. **Автоматическая регистрация через CLI:**
   - Управление и создание проводятся через `scripts/github_mcp_cli.py`:
     ```bash
     # Создание Issue:
     python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 issues create --title "..." --body "..."

     # Создание PR с привязкой:
     python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 prs create --title "..." --head <branch> --base main --body "Closes #<IssueID>"
     ```
4. **Самостоятельный Ревью и Авто-Мерж (Agent Self-Review & Auto-Merge):**
   - Агенты самостоятельно проводят ревью открытого PR на наличие ошибок, утечек, граничных случаев и недочетов.
   - Если тесты/CI полностью пройдены и никаких подозрений на проблемы или риски нет, агент сливает свой PR в `main` самостоятельно через `python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 prs merge --number <PR_NUM>`.
5. **Синхронизация таблиц координирования:**
   - При создании Issue / PR или изменении статуса агенты обновляют таблицу в `docs/session_coordination.md`, указывая номера `#Issue` и `#PR`.
   - При слиянии PR статус в таблице переводится в `✅ Завершено (PR #X)`.
