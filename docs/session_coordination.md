# Координация сессий и распределение задач для AI-Агентов (Jules / Gemini)

Документ предназначен для координации совместной параллельной работы нескольких сессий AI-агентов над проектом **MCP Rooms Marketplace (`LeonidYasin/mcp-rooms-googleai-2`)**.

---

## 🚦 Текущий статус и разделение зон ответственности

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
| **Поддержка Last-Event-ID в SSE** | Сессия C (Jules) | ✅ Завершено (PR #28) | PR #28 merged in `main` (`tests/sse_replay.test.ts`, `server.ts`) |
| **Строгая проверка прав владения (Ownership Checks)** | Сессия C (Jules) | ✅ Завершено (PR #39) | PR #39 merged in `main` (`PUT /api/listings/:id`, `tests/ownership_checks.test.ts`) |
| **Healthchecks & Readiness Probes (/healthz & /readyz)** | Сессия C (Jules) | ✅ Завершено (PR #41) | PR #41 merged in `main` (`server.ts`, `tests/healthchecks.test.ts`) |
| **Структурированное логирование (JSON Logs)** | Сессия C (Jules) | ✅ Завершено (PR #43) | PR #43 merged in `main` (`server/logger.ts`, `tests/logger.test.ts`) |
| **Повторный комплексный аудит безопасности и архитектуры** | Сессия C (Jules) | ✅ Завершено (PR #45) | PR #45 merged in `main` (`docs/audit_v2.md`) |
| **Caddy / Reverse Proxy Config & TLS** | Сессия A (Jules) | ✅ Завершено | `Caddyfile`, PR #29 |
| **Playwright Headless E2E Tests (Локально и Runner)** | Сессия A (Jules) | ✅ Завершено | `tests/e2e/`, `playwright.config.ts`, PR #38 |
| **Интеграция Playwright E2E в CI (GitHub Actions)** | Любая свободна | ⏳ Открыта | Добавление шага `npm run test:e2e` в `.github/workflows/ci.yml` |
| **Мульти-агентные переговоры в комнатах (Real Negotiation Protocol)** | Любая свободна | ⏳ Открыта | Перевод `negotiate_agreement` из демо-режима в реальные сделки |
| **Подсистема Webhooks & Async Event Notifications** | Любая свободна | ⏳ Открыта | Уведомления внешним агентам при событиях комнат |

---

## 🤝 Правила совместной работы

1. **Создание веток:**
   - Всегда создавайте новую отдельную ветку для задачи: `feat/<название-задачи>` или `fix/<описание>`.
   - Именуйте ветки явно, чтобы не затирать работу соседней сессии.

2. **Запуск тестов перед PR:**
   - Обязательно проверяйте прохождение всех тестов через `npm test` (в проекте используются `vitest`).

3. **Создание и слияние PR:**
   - Используйте инструмент `scripts/github_mcp_cli.py` для создания PR:
     ```bash
     GITHUB_TOKEN="$TOKEN" python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 prs create --title "..." --head <branch> --base main --body "..."
     ```
   - Если тесты CI проходят, PR можно сливать командой `prs merge --number <PR_NUM>`.

4. **Обновление этого документа (`docs/session_coordination.md`):**
   - В завершение работы по каждой задаче отмечайте статус `✅ Завершено` в таблице выше, чтобы параллельная сессия всегда видела актуальный прогресс!
