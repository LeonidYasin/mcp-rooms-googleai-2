# Анализ готовности к Production и Дорожная карта (Roadmap)

В этом документе содержится объективная оценка готовности проекта **MCP Rooms Marketplace (`LeonidYasin/mcp-rooms-googleai-2`)** к боевой промышленной эксплуатации, актуальный статус ранее запланированных работ и детальный план оставшихся задач до статуса готового продукта.

---

## 🚦 Текущий статус готовности к Production

Проект прошёл стадию прототипа и базового MVP: развёрнут на VPS (`https://leonid-mcp.duckdns.org`), Caddy обеспечивает валидный TLS и SSE-проксирование, реализована спецификация MCP (JSON-RPC 2.0 over HTTP), персистентные токены и тикетная авторизация стримов.

Однако для статуса **полноценного готового продукта (Production-Grade)** необходимо устранить ключевые архитектурные и функциональные разрывы между маркетинговыми декларациями и реальным кодом.

### ⚠️ Критические разрывы и блокеры до статуса 100% Production Ready:

1. **Отключенный пайплайн эмбеддингов (Embeddings Disabled):**
   - В боевой среде `EMBEDDING_PROVIDER=disabled`. Семантический поиск и асимметричный матчинг деградируют до лексического `LIKE` по SQLite. Нет локального кэширования векторов и фоновой переиндексации. (См. Issue [#114](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/114)).
2. **Демо-статус инструмента `negotiate_agreement`:**
   - Инструмент агентов `negotiate_agreement` отдаёт статический `demo_preview`. Реальный протокол мульти-агентных торгов, обмен структурированными офертами и коммит соглашений в БД не завершены. (См. Issue [#56](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/56)).
3. **Отсутствие асинхронных Webhooks для внешних AI-агентов:**
   - Автономные агенты вынуждены опрашивать сервер поллингом. Нужна подсистема регистрации Webhook URL с подписью HMAC-SHA256 и очередью повторов. (См. Issue [#57](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/57)).
4. **Неидемпотентность сидирования и дубликаты в базе данных:**
   - При повторных прогонах `seed:demo` в базе плодятся идентичные карточки без проверки уникальности. Необходим скрипт очистки и дедупликации. (См. Issue [#115](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/115)).
5. **Монолитный `server.ts` (1500+ строк):**
   - Вся логика роутов, загрузок, MCP и стримов собрана в одном файле. Необходима декомпозиция на модульные Express-роутеры и контроллеры. (См. Issue [#116](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/116)).
6. **Отсутствие Playwright E2E в CI пайплайне:**
   - E2E-тесты написаны, но не включены в GitHub Actions workflow. (См. Issue [#55](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/55)).
7. **Отсутствие скрипта валидации документации:**
   - В `package.json` объявлен `npm run lint:docs`, ссылающийся на отсутствующий файл `scripts/validate-docs.ts`. (См. Issue [#117](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/117)).

---

## 💡 Дорожная карта задач (Production Readiness Roadmap)

### 🔴 Приоритет 1: Ядро AI, данные и протокол (P1 — Core Product Readiness)

- [x] **1.1 Персистентная загрузка и хранение фото (`/uploads`)** *(Завершено — PR #32)*
  - Загрузка файлов на сервер, валидация размера (5MB) и сохранение путей в SQLite.
- [x] **1.2 Безопасная авторизация SSE через одноразовые тикеты** *(Завершено — PR #22, #25)*
  - Эндпоинт `POST /api/rooms/:id/ticket` с TTL 30 секунд. Предотвращает утечку токенов в query-параметрах.
- [x] **1.3 Персистентный Rate Limiting & Trust Proxy** *(Завершено — PR #13, #29)*
  - Учёт лимитов в SQLite (`rate_limit_hits`) и `app.set('trust proxy', 1)`.
- [x] **1.4 Персистентный Replay в SSE по `Last-Event-ID`** *(Завершено — PR #30)*
  - Таблица `room_events` в SQLite, надёжная доотправка сообщений при разрыве соединения.
- [ ] **1.5 Продакшен-пайплайн Gemini Embeddings и векторного матчинга** *(В планах — Issue [#114](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/114))*
  - Включение `text-embedding-004` через `@google/genai` с кэшированием векторов в таблице `listing_embeddings` SQLite.
  - Фоновый переиндексатор `scripts/reindex-embeddings.ts` и расчёт косинусного сходства для `match_listings`.
- [ ] **1.6 Идемпотентность сидирования и очистка базы от дубликатов** *(В планах — Issue [#115](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/115))*
  - Скрипт миграции `scripts/cleanup-duplicates.ts` для дедупликации живой базы на проде.
  - Идемпотентный `scripts/seed-demo.ts` с уникальными индексами.

---

### 🟡 Приоритет 2: Агентная автономность и архитектура (P2 — Multi-Agent & Architecture)

- [ ] **2.1 Мульти-агентный реальный протокол переговоров (Real Negotiation Protocol)** *(В планах — Issue [#56](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/56))*
  - Перевод `negotiate_agreement` из `demo_preview` в реальный жизненный цикл: создание комнаты, обмен структурированными офертами, фиксация соглашения в БД.
- [ ] **2.2 Подсистема асинхронных Webhooks для внешних AI-агентов** *(В планах — Issue [#57](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/57))*
  - Регистрация webhook-URL, отправка событий (сообщения, офферы, матчи) с подписью HMAC-SHA256 (`X-MCP-Signature`) и экспоненциальным backoff.
- [ ] **2.3 Модульная декомпозиция монолита `server.ts`** *(В планах — Issue [#116](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/116))*
  - Разделение на роуты: `listings.ts`, `rooms.ts`, `uploads.ts`, `auth.ts`, `chat.ts`, `mcp.ts`.
  - Фабрика `server/app.ts` для изолированного тестирования.
- [x] **2.4 Проверка прав владения (Ownership Checks)** *(Завершено — PR #39)*
  - Проверка `owner === principalId` для модификации и удаления объявлений.

---

### 🟢 Приоритет 3: CI/CD, документация и надежность (P3 — CI/CD & Governance)

- [ ] **3.1 Интеграция Playwright E2E в CI workflow** *(В планах — Issue [#55](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/55))*
  - Добавление шага Playwright тестов в `.github/workflows/ci.yml`.
- [ ] **3.2 Создание скрипта валидации документации (`scripts/validate-docs.ts`)** *(В планах — Issue [#117](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/117))*
  - Реализация `npm run lint:docs`: проверка целостности относительных ссылок и актуальности MCP-манифеста.
- [x] **3.3 Контракт честности LLM (`chat-honesty.test.ts`)** *(Завершено — PR #2)*
  - Запрет на фальсификацию вызовов инструментов и обязательная декларация `degraded: true`.
- [x] **3.4 Защита от абуза и нагрузочные тесты (`tests/e2e-abuse.test.ts`)** *(Завершено — PR #33)*
- [x] **3.5 Продакшен-конфигурация Caddy с SSL и сжатием** *(Завершено — PR #29, #35)*
