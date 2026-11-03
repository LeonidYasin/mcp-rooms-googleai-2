# Финальная Дорожная Карта Выхода в Продакшен (100% Production Readiness Roadmap)

Документ описывает полный перечень шагов, необходимых для перехода проекта **MCP Rooms Marketplace (`LeonidYasin/mcp-rooms-googleai-2`)** из статуса продвинутого прототипа в статус 100% готового боевого коммерческого продукта.

---

## 🎯 Модули дорожной карты и трекинг задач

### 🟢 Модуль 1: Безопасность стримов и тикетная авторизация SSE (Ticket-based SSE Auth)
- **Статус:** ✅ **ЗАВЕРШЕНО (PR #22, #25)**
- **Результат:** Исключена утечка токенов в query-параметрах URL благодаря одноразовым тикетам подключения (`POST /api/rooms/:id/ticket`).

### 🟢 Модуль 2: Персистентный Event Store и Replay в SSE
- **Статус:** ✅ **ЗАВЕРШЕНО (PR #30)**
- **Результат:** Внедрена таблица `room_events` в SQLite, гарантирующая доставку пропущенных событий по заголовку `Last-Event-ID`.

### 🟢 Модуль 3: Персистентное хранение медиа и загрузок (`/uploads`)
- **Статус:** ✅ **ЗАВЕРШЕНО (PR #15, #32)**
- **Результат:** Реализован эндпоинт `POST /api/uploads` с персистентным сохранением на диск в `data/uploads/` и привязкой к карточкам.

### 🟢 Модуль 4: Инфраструктурный Caddy Reverse Proxy & TLS
- **Статус:** ✅ **ЗАВЕРШЕНО (PR #29, #35)**
- **Результат:** Настроен `Caddyfile` с авто-TLS, сжатием zstd/gzip и сквозным проксированием SSE (`flush_interval -1`).

---

### 🟢 Модуль 5: Продакшен-пайплайн Gemini Embeddings и векторного матчинга
- **Статус:** ✅ **ЗАВЕРШЕНО (Issue [#114](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/114))**
- **Ответственный:** AI & Data Platform Agent
- **Результат:** Реализован сквозной пайплайн векторного семантического матчинга:
  1. Интеграция `text-embedding-004` через `@google/genai` с кэшированием в таблице `listing_embeddings` SQLite.
  2. Фоновый CLI-индексатор `scripts/reindex-embeddings.ts` (`npm run embeddings:reindex`).
  3. Автоматический расчёт векторов при создании/обновлении объявлений через API и MCP.
  4. Асимметричный расчёт косинусного сходства (0.0–1.0) с безопасным лексическим фолбэком.

### 🔴 Модуль 6: Идемпотентность сидирования и дедупликация базы данных
- **Статус:** 📋 **В ПЛАНАХ (Issue [#115](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/115))**
- **Ответственный:** DB & Data Quality Agent
- **Описание:** Очистка продакшен-базы данных и гарантия чистоты данных:
  1. Скрипт миграции `scripts/cleanup-duplicates.ts` для удаления существующих дубликатов.
  2. Идемпотентный сидирующий скрипт `scripts/seed-demo.ts` с уникальными индексами в SQLite.

### 🟡 Модуль 7: Мульти-агентный реальный протокол переговоров (Real Negotiation Protocol)
- **Статус:** 📋 **В ПЛАНАХ (Issue [#56](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/56))**
- **Ответственный:** Multi-Agent & Protocol Agent
- **Описание:** Перевод инструмента `negotiate_agreement` из симуляции `demo_preview` в реальный жизненный цикл сделки:
  1. Автоматическое создание переговорной комнаты или подключение к существующей.
  2. Обмен структурированными офертами (`terms: { price, delivery_date, guarantees }`).
  3. Двусторонний консенсус и сохранение согласованной сделки в таблице `negotiations`.

### 🟡 Модуль 8: Асинхронные Webhooks для внешних AI-агентов
- **Статус:** 📋 **В ПЛАНАХ (Issue [#57](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/57))**
- **Ответственный:** Protocol & Integration Agent
- **Описание:** Избавление внешних агентов от необходимости поллинга:
  1. Эндпоинты управления подписками `POST /api/webhooks`, `DELETE /api/webhooks/:id`.
  2. Доставка событий комнат и матчинга с подписью HMAC-SHA256 (`X-MCP-Signature`) и экспоненциальным backoff.

### 🟡 Модуль 9: Модульная декомпозиция монолита `server.ts`
- **Статус:** 📋 **В ПЛАНАХ (Issue [#116](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/116))**
- **Ответственный:** Backend Architecture Agent
- **Описание:** Разделение 1500-строчного монолита `server.ts` на отдельные модули роутинга (`listings.ts`, `rooms.ts`, `uploads.ts`, `auth.ts`, `chat.ts`, `mcp.ts`) и фабрику `server/app.ts`.

### 🟢 Модуль 10: Интеграция Playwright E2E в CI workflow
- **Статус:** 📋 **В ПЛАНАХ (Issue [#55](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/55))**
- **Ответственный:** QA & CI Agent
- **Описание:** Автоматический запуск E2E-тестов в `.github/workflows/ci.yml`.

### 🟢 Модуль 11: Валидация документации (`scripts/validate-docs.ts`)
- **Статус:** 📋 **В ПЛАНАХ (Issue [#117](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/117))**
- **Ответственный:** Documentation & Governance Agent
- **Описание:** Восстановление `npm run lint:docs` для контроля целостности ссылок и актуальности MCP-манифеста.

---

## 🚦 Сводный статус готовности модулей

| Модуль | Описание | Ответственный | Issue / PR | Статус |
| :--- | :--- | :--- | :--- | :--- |
| **Модуль 1** | Ticket-based SSE Auth | Protocol & Security | PR #25 | ✅ Завершено |
| **Модуль 2** | Event Store & Replay (`Last-Event-ID`) | Protocol & Core | PR #30 | ✅ Завершено |
| **Модуль 3** | Хранилище загрузок (`/uploads`) | Storage & Backend | PR #32 | ✅ Завершено |
| **Модуль 4** | Caddy Reverse Proxy & TLS | Ops & Infra | PR #29, #35 | ✅ Завершено |
| **Модуль 5** | Gemini Embeddings & Vector Search | AI & Data Platform | [#114](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/114) | ✅ Завершено |
| **Модуль 6** | Идемпотентность сидирования и дедупликация | DB & Quality | [#115](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/115) | 📋 В планах (P1) |
| **Модуль 7** | Реальный протокол переговоров | Multi-Agent | [#56](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/56) | 📋 В планах (P2) |
| **Модуль 8** | Подсистема Webhooks для агентов | Protocol & Integration | [#57](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/57) | 📋 В планах (P2) |
| **Модуль 9** | Модульный рефакторинг `server.ts` | Backend Architecture | [#116](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/116) | 📋 В планах (P2) |
| **Модуль 10** | Playwright E2E в GitHub Actions CI | QA & CI | [#55](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/55) | 📋 В планах (P3) |
| **Модуль 11** | Авто-линтер документации (`lint:docs`) | Documentation | [#117](https://github.com/LeonidYasin/mcp-rooms-googleai-2/issues/117) | 📋 В планах (P3) |
