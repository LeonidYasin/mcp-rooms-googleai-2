# План PR: от прототипа к production

Основание: `docs/audit/2026-10-27-audit.md` (коммит `a5fb1c1`). Каждый PR — одна проверяемая граница. Правила те же, что в `mcp-rooms`: **зелёный CI на SHA источника — обязательное условие**, CI ≠ TEST ≠ production, деплой и merge — только по отдельному решению владельца.

## 0. Что считается «production» для этого прототипа

Не «сайт открылся», а четыре гейта:

| Гейт | Содержание | Чем доказывается |
| --- | --- | --- |
| G1. Сборка | `tsc --noEmit`, `vitest run`, `vite build`, запуск сервера в `NODE_ENV=production` | зелёный Actions на SHA |
| G2. Доступ | у каждого запроса есть субъект; чужая комната → `403`/`404`; публичная витрина отделена от переписки | негативные тесты (без токена, чужой токен, чужой room_id) |
| G3. Правдивость | ни один ответ API/UI не содержит вызовов инструментов и договорённостей, которых не было | тест на отсутствие синтетических `executedTools`; ручная проверка демо-режима |
| G4. Эксплуатация | воспроизводимая сборка, non-root, healthcheck, бэкап SQLite, лимиты | Dockerfile/compose + отчёт restore |

Публичный деплой (домен, Caddy, ключи, реальные данные) — **не PR**, а отдельное одобрение владельца с паролем. До него продукт остаётся release candidate.

## 1. Последовательность

```
PR-0  docs: аудит + план (этот файл)                    [S]
PR-1  ci: node-пайплайн, prod smoke, два блокера        [M]  → G1
PR-2  fix: убрать синтетические tool calls              [M]  → G3 (часть)
PR-3  feat(auth): субъект, комнаты, публичная витрина   [L]  → G2
PR-4  feat(auth): identity parity — scopes/TTL/делегирование [L] → G2
PR-5  feat(mcp): транспорт по спецификации               [L]
PR-6  feat(listings): draft → preview → publish          [L]
PR-7  fix(negotiation): убрать хардкод и авто-публикацию [M]  → G3
PR-8  chore(seed): демо-данные вне production            [S]
PR-9  feat(sse): auth, реплей, лимиты                    [M]
PR-10 feat(llm): честный degraded mode, конфиг моделей   [M]
PR-11 build: воспроизводимый Docker, non-root, бэкап     [M]  → G4
PR-12 test+docs: E2E, abuse, переписать документацию     [L]  → RC
---   deploy: изолированный TEST + приёмка               [owner-gated]
```

Зависимости: PR-2 и PR-1 независимы; PR-3 блокирует PR-4, PR-5, PR-9; PR-4 блокирует PR-5; PR-6 блокирует PR-7; PR-12 требует PR-1…PR-11. PR-8 можно делать в любой момент.

## 2. PR-0 — документация аудита

- **Область:** `docs/audit/2026-10-27-audit.md`, `docs/audit/pr-plan.md`, `docs/audit/comparison-with-mcp-rooms.md`, `docs/audit/integration-into-mcp-rooms.md`.
- **Не входит:** правки кода, удаление унаследованных `docs/`.
- **Приёмка:** документы ссылаются на `file:line`; каждая находка имеет ID; план не обещает сроков и не заявляет деплой.
- **CI:** не требуется (docs-only), но прогон не должен ломаться.

## 3. PR-1 — рабочий CI и два блокера

- **Область:**
  - удалить `.github/workflows/{pages,operator-package,operator-supervision}.yml`;
  - переписать `ci.yml`: Node 22, `npm install --no-audit --no-fund`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, затем smoke: `NODE_ENV=production node --import tsx server.ts` + `curl /api/listings` + `curl -X POST /mcp -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
  - `server.ts:753`: `app.get('*', …)` → `app.get('/{*splat}', …)` (Express 5);
  - согласовать контракт `search_listings`: `server/mcp.ts:208-209` и `tests/mcp-tools.test.ts:29-31` (решение: оставить `items`/`total_found`, править тест; зафиксировать форму в `docs/api.md`);
  - добавить `.env.example` с пустыми значениями (`PORT`, `GEMINI_API_KEY=`, `EMBEDDING_PROVIDER`, `DATABASE_PATH`).
- **Приёмка:** все шаги зелёные на SHA; smoke падает, если вернуть старый `app.get('*')` (проверить один раз вручную до мержа).
- **Риск:** `npm install` без lock-файла недетерминирован; PR-10 добавляет lock. До PR-10 в CI пинить мажорные версии.
- **Почему первым:** без этого остальные PR нечем проверять.

## 4. PR-2 — убрать синтетические вызовы инструментов

- **Область:**
  - `src/components/McpConsole.tsx`: удалить `handleExecuteTool`-имитацию (`:66-150`) и список несуществующих инструментов (`:330-341`); оставить реальные 9 из манифеста, вызывать `POST /mcp` через общий клиент; показывать ошибку сервера как ошибку;
  - `server.ts:540-700`: из fallback-ветки `/api/chat` удалить `executedTools` с несовершёнными вызовами (`:613-621`, `:681`); при degraded-режиме возвращать `{ degraded: true, reason }` и текст без «я сделал»;
  - бейдж «Протокол: MCP (v1.0)» заменить на фактический статус (`tools: 9`, `transport: json-rpc-post`).
- **Приёмка:** grep по `executedTools` не находит записей, не подтверждённых результатом `executeMcpToolCall`; в UI нет ни одного действия, которое не делает сетевой вызов; тест: запрос в degraded-режиме → `executedTools: []`.
- **Не входит:** реальная интеграция переговоров (PR-6).

## 5. PR-3 — субъект, комнаты, витрина

- **Область:**
  - ввести субъекта запроса: Bearer-ключ агента/пользователя (digest-only хранение) или подписанную сессию; middleware `requireSubject`;
  - `rooms`: таблица участников, `GET /api/rooms` → только комнаты субъекта; `GET /api/rooms/:id` и `/messages` → `403` для не-участника; `sender` берётся из субъекта, не из тела;
  - `resources/read` `rooms://all` — удалить или ограничить участником/аудитом;
  - публичная витрина: отдельный контракт `GET /api/public/listings` (только `status='published'`, allowlist полей);
  - аудит-лог доступа к комнатам.
- **Приёмка (негативные тесты обязательны):** без токена → `401`; чужой субъект → `403`; список комнат не содержит чужих; сообщение от имени другого участника невозможно; публичная выдача не содержит телефонов/адресов/переписки.
- **Риск:** это изменение схемы — нужна миграция (см. `server/db.ts:115` уже содержит проверку колонок, расширить тем же подходом).

## 6. PR-4 — identity parity: scopes, TTL, делегирование

- **Область:** `server/db.ts` (`users`, `credentials`: id, digest, resource, scopes, expiry, revocation),
  `server/auth.ts` (per-request auth, `requireScope`, fail-closed), `GET /identity`,
  `POST /credentials` (копия не шире источника), `DELETE /credentials/current`,
  `scripts/auth-cli.ts` (`npm run auth -- user|key …`), scopes на REST и per-tool,
  запрет токена в query (`?access_token=`), SSE через `fetch` с `Authorization`.
- **Контракт:** повторяет `src/mcp_rooms/identity.py` и `server.py` исходного `mcp-rooms`:
  scopes `rooms:read|write`, `listings:read|write`, TTL 7 дней по умолчанию (max 90),
  20 ключей на пользователя, `401 invalid_token` + `WWW-Authenticate`, `403 insufficient_scope`,
  `503 authentication_unavailable`, resource binding через `MCP_RESOURCE`.
- **Осознанные отступления:** principal id задаёт оператор (`user:<slug>`), а не серверный UUID;
  self-service enrollment и OAuth-сервер не входят в этот PR. Формат токена —
  `mcr_<32 hex>.<43 base64url>` вместо `rm1_…`.
- **Приёмка (негативные тесты обязательны):** без ключа → `401`; истёкший/отозванный/отключённый → `401`;
  ключ без scope → `403`/payload-ошибка; делегирование не расширяет scopes и TTL;
  `/identity` не содержит секрета; `?access_token=` → `400`; SSE работает с заголовком.
- **Не входит:** официальный MCP SDK и Streamable HTTP (PR-5), draft → publish (PR-6).

## 7. PR-5 — MCP-транспорт по спецификации

- **Область:** `POST /mcp` → Streamable HTTP: `initialize` (согласование `protocolVersion`), `notifications/initialized`, `Mcp-Session-Id`, `Accept: application/json, text/event-stream`, корректные коды ошибок, `ping`, отказ на неизвестную версию; `tools/list`/`tools/call` с проверкой схемы аргументов (zod) и субъекта.
- **Приёмка:** подключение эталонным клиентом (MCP Inspector или официальный SDK) проходит `initialize` → `tools/list` → `tools/call`; без токена `tools/call` → `401`; неизвестная версия → `400`.
- **Не входит:** новые инструменты. Состав — только 9 существующих, минус `negotiate_agreement` (уходит в PR-7).

## 8. PR-6 — честный путь публикации

- **Область:** `POST /api/listings` → только `draft` (валидация zod, `owner` из субъекта, `visibility` не из тела); `preview` (immutable snapshot + diff), `publish` (явное согласие, `revision` CAS), `withdraw`; идемпотентность по ключу команды; убрать прямую запись в `createListingInDb` из REST и MCP.
- **Приёмка:** нельзя опубликовать без preview и согласия; повторный publish идемпотентен; чужой draft → `403`; невалидный контент → `422` со списком ошибок.
- **Ссылка:** контракт `listing_contract` из основного проекта (`docs/marketplace-conformance.md`) — переносить поля, а не код.

## 9. PR-7 — переговоры: убрать фабрикацию

- **Вариант A (рекомендуемый, дешевле):** `negotiate_agreement` удаляется из манифеста; сценарий остаётся только в демо-режиме с явной маркировкой `demo: true` и баннером в UI; `agreedTerms`/`safetyConfirmed` не создаются.
- **Вариант B (если нужен продукт):** обмен предложениями между двумя *разными* субъектами: `propose_terms` (одна сторона) → `respond_to_terms` (другая) → `record_agreement` только при явном согласии обеих сторон с подписью субъекта и временем; никаких «подтверждено» без действия.
- **Приёмка:** `grep -r "safetyConfirmed" server/` пуст; в БД нет соглашения без двух записей согласия; создание объявления из переговоров удалено.
- **Затрагивает:** `server/negotiator.ts` (190-280 — удаляется целиком), `server/mcp.ts`, `server/db.ts` (`negotiations`).

## 10. PR-8 — демо-данные вне production

- **Область:** `seedInitialData()`/`seedProfilesIfEmpty()` (`server/db.ts:127-134`) вызываются только при `DEMO_SEED=1`; отдельный скрипт `npm run seed:demo`; в production пустая БД остаётся пустой.
- **Приёмка:** старт с пустой БД и без флага → 0 объявлений, 0 профилей; с флагом → фиксированный набор; тест на оба режима.

## 11. PR-9 — SSE

- **Область:** авторизация подписки (PR-3), лимит подписчиков на комнату и на процесс, реплей по `Last-Event-ID` из таблицы событий (а не из памяти), идемпотентные `event.id` (монотонный счётчик в БД), корректное завершение при shutdown.
- **Приёмка:** переподключение с `Last-Event-ID` не теряет и не дублирует сообщения (тест: 3 сообщения, обрыв, реплей); 51-й подписчик получает `429`; после рестарта история воспроизводима.

## 12. PR-10 — LLM-слой без вранья

- **Область:** `model` из env (`GEMINI_MODEL`), проверка доступности при старте (`GET /api/llm/status`), явный `degraded` в ответах, `timeout`/`retry`, лимит вызовов на субъекта, удаление keyword-роутинга, выдающего себя за агента (оставить как `rule_based_fallback: true`).
- **Приёмка:** при неверном ключе `/api/chat` возвращает `200` + `degraded: true` и ни одного `executedTools`; в логах — одна запись, без 30-секундного кэша-сюрприза (`server.ts:34-40` заменить на явный circuit breaker с метрикой).

## 13. PR-11 — сборка и эксплуатация

- **Область:** `bun install --frozen-lockfile` (lock уже есть) **или** добавить `package-lock.json` и `npm ci` — выбрать одно и убрать второе; multi-stage Docker только с `dist/` и production-зависимостями; `USER node`; права `700` на `/app/data`; `HEALTHCHECK`; `docker-compose` без `${GEMINI_API_KEY:-}`-умолчания (падать, если ключ пуст и `EMBEDDING_PROVIDER=google`); скрипт бэкапа SQLite (`VACUUM INTO`) и проверенный restore.
- **Приёмка:** два прогона сборки дают одинаковый `sha256` артефакта; контейнер стартует non-root; restore из бэкапа проверен на копии.

## 14. PR-12 — E2E, abuse, документация

- **Область:** E2E: агент публикует карточку → второй пользователь видит её в витрине → отклик в комнате → `403` для третьего; abuse: 10 МБ тело, 1000 сообщений/мин, XSS в названии, SQL-строка в фильтре; переписать `README.md`, `AGENTS.md`, удалить `docs/` основного проекта и `web/prototype/`, `.aistudio/`; зафиксировать `docs/api.md` как контракт; `docs/production-readiness.md` — свои, а не унаследованные.
- **Приёмка:** полный прогон CI; README не содержит непроверенных утверждений (сверка по таблице §6 аудита); release candidate с checksum и SHA.

## 15. Гейт «deploy» (не PR)

Требует отдельного одобрения владельца и пароля на каждую операцию: VPS-доступ, Caddy/HTTPS, выдача ключей, реальные данные. Порядок: свежий preflight → отдельный пользователь/unit/БД/порт → loopback smoke → HTTPS только после проверки → приёмка на реальном сценарии → остановка/rollback. До этого — только release candidate.

## 16. Anti-goals (не делать в этом плане)

- не добавлять новые категории (`jobs`, `dating`, `rides`, `delivery`) до первого проверенного сценария — это расширение продукта, не исправление;
- не вводить платежи, рейтинги, «продажи» и статистику;
- не переносить `.aistudio`-артефакты и сгенерированный `implementation_plan.md` в документацию;
- не заменять Python-кандидат основного проекта этим стеком (см. `comparison-with-mcp-rooms.md`);
- не деплоить до G1–G3 и отдельного одобрения.

## 17. Оценка

13 PR, из них 3 крупных (PR-3, PR-4, PR-5). Оценка в человеко-днях здесь не даётся: она зависит от ревью владельца, а не от объёма кода. Порядок важнее календаря: G1 достигается на PR-1, G2 — на PR-3+PR-4, G3 — на PR-2+PR-7, G4 — на PR-11, RC — на PR-12.
