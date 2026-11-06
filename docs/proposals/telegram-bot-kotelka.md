# RFC / Architecture Proposal: Telegram-бот «Хотелка» (Kotelka)

> **Статус документа:** Proposed / Companion Client Specification  
> **Целевой репозиторий реализации:** Внешний отдельный репозиторий (например, `LeonidYasin/mcp-telegram-bot` или `kotelka-bot`)  
> **Целевой бэкенд:** Координационный слой Marketplace OS / MCP Rooms (`https://leonid-mcp.duckdns.org/mcp`)  
> **Дата:** Ноябрь 2026  

---

## 1. Концепция и назначение

Telegram-бот **«Хотелка»** — это мобильный клиент первого контакта для физических лиц и предпринимателей, работающий поверх открытого координационного слоя **Marketplace OS / MCP Rooms**.

### Ключевая проблема
Обычные пользователи не умеют взаимодействовать с JSON-RPC API, не устанавливают MCP-клиенты и не знают строгой структуры категорий. Они формулируют свои потребности и предложения в свободной форме на естественном языке (например: *«Ищу фронтендера на React в Казани на парт-тайм до 80к»* или *«Сдаю однушку около метро Бауманская за 50к без комиссии»*).

### Решение
Бот выступает интеллектуальным адаптером (Human-to-MCP Gateway):
1. Принимает естественный язык от пользователя.
2. С помощью легковесной LLM (**Gemini 1.5 Flash**) структурирует запрос в строгий формат каталога Marketplace OS.
3. Показывает интерактивную карточку для подтверждения (Human-in-the-loop).
4. Публикует объявление через двухфазный CAS-контракт (`create_listing` → `preview_listing` → `publish_listing`).
5. В фоновом режиме (по вебхукам или расписанию) находит встречные совпадения (`match_listings`), инициирует комнаты переговоров (`join_room`) и позволяет договариваться прямо из Telegram.

---

## 2. Архитектурная схема

```
Telegram Client (Пользователь)
        │
        ▼ (HTTPS Telegram Bot API)
┌────────────────────────────────────────────────────────┐
│               Telegram Bot Backend                     │
│  (Python aiogram 3.x / TypeScript grammY)              │
│                                                        │
│  ┌────────────────────┐      ┌──────────────────────┐  │
│  │   LLM Extractor    │      │    Local Bot DB      │  │
│  │   (Gemini Flash)   │      │      (SQLite)        │  │
│  │  Парсинг в JSON    │      │  • tg_user → key     │  │
│  └────────────────────┘      │  • FSM диалогов      │  │
│                              │  • seen_matches      │  │
│  ┌────────────────────┐      └──────────────────────┘  │
│  │ Webhook Listener   │                                │
│  │ /webhook/mcp       │◄────────────────────────────┐  │
│  └────────────────────┘                             │  │
└──────────────┬──────────────────────────────────────┼──┘
               │ JSON-RPC (HTTP POST /mcp)            │ Webhooks
               │ Authorization: Bearer mcr_...        │ (listing.published)
               ▼                                      │
┌─────────────────────────────────────────────────────┴──┐
│          MCP Rooms (Marketplace OS Platform)           │
│           https://leonid-mcp.duckdns.org/mcp           │
│                                                        │
│  • 13 нативных MCP-инструментов                        │
│  • Асимметричный семантический матчинг (Embeddings)    │
│  • Приватные переговорные комнаты (Rooms & A2A)        │
│  • Структурированный протокол оферт (Negotiator)       │
└────────────────────────────────────────────────────────┘
```

---

## 3. Схема диалога и конечный автомат (FSM)

Состояние диалога каждого пользователя персистентно сохраняется в локальной SQLite бота:

| Состояние | Триггер входа | Действие бота | Переход |
| :--- | :--- | :--- | :--- |
| **`idle`** | `/start`, новое текстовое сообщение | Передаёт текст в Gemini Flash. Если данные полные → `confirming`; если не хватает ключевых полей → `asking`. | `confirming` / `asking` |
| **`asking`** | LLM вернул `missing_fields` | Задает 1–2 целевых вопроса (например: *«Укажи город»* или *«Ты ищешь или предлагаешь?»*). | `confirming` |
| **`confirming`** | Валидный черновик готов | Показывает карточку с разметкой объявления и Inline-кнопками: **«✅ Опубликовать»**, **«✏️ Изменить»**, **«❌ Отмена»**. | `publishing` / `editing` / `idle` |
| **`editing`** | Нажата кнопка **«✏️ Изменить»** | Просит пользователя написать уточнение и повторно нормализует черновик. | `confirming` |
| **`publishing`** | Нажата кнопка **«✅ Опубликовать»** | Выполняет цепочку `create_listing` → `preview_listing` → `publish_listing`. | `watching` |
| **`watching`** | Объявление опубликовано | Сообщает: *«Объявление активно! Я слежу за встречными предложениями и сразу пришлю уведомление»*. | `idle` |
| **`negotiating`** | Найдено совпадение / создана комната | Позволяет переписываться с контрагентом или его AI-агентом прямо из Telegram. | `watching` / `idle` |

---

## 4. Спецификация LLM-экстрактора (Gemini Flash)

### Системный промпт (версионируемый)
Промпт строго синхронизирован со схемой базы данных и перечислениями Marketplace OS:

```text
Ты — интеллектуальный парсер объявлений для сервиса «Хотелка».
Пользователь пишет в свободной форме то, что он ищет или предлагает.
Твоя задача — извлечь структурированное объявление строго по схеме.
НЕ выдумывай факты, которых нет в сообщении.

Верни СТРОГО валидный JSON без markdown-тегов:
{
  "kind": "request" | "offer" | "unclear",
  "category": "business" | "jobs" | "services" | "real_estate" | "communities" | "things" | "dating" | "rides" | "delivery" | "other",
  "title": "краткий заголовок до 80 символов",
  "description": "полный текст описания с сохранением всех важных деталей",
  "locality": "город (строка) или null",
  "price_rubles": число_в_рублях_или_0,
  "missing_fields": ["locality" | "kind" | "description"]
}

Правила маппинга:
1. "kind":
   - "request" — если пользователь ищет, покупает, хочет заказать или нанять;
   - "offer" — если пользователь продает, сдает, предлагает услуги или ищет клиентов;
   - "unclear" — если невозможно определить направление.
2. "category":
   - "business" — партнерство, сооснователи, инвестиции, продажа бизнеса;
   - "jobs" — вакансии, резюме, поиск работы или найм сотрудников;
   - "services" — бытовые, цифровые, ремонтные и юридические услуги;
   - "real_estate" — аренда и продажа квартир, офисов, складов;
   - "communities" — клубы по интересам, митапы, совместные активности;
   - "things" — купля/продажа физических товаров, техники, велосипедов и т.д.;
   - "dating" — знакомства, поиск пары;
   - "rides" — поездки, попутчики, трансфер;
   - "delivery" — курьеры, грузоперевозки;
   - "other" — всё остальное.
3. "locality": Если город не назван, оставь null и добавь "locality" в missing_fields (город обязателен для публикации).
4. "price_rubles": Цены вида "до 50к" конвертируй в 50000. Если цена не указана — 0 (договорная).
```

---

## 5. Интеграция с MCP-инструментами (Контракты вызовов)

Все запросы отправляются на URL `https://leonid-mcp.duckdns.org/mcp` методом `POST` с заголовком:
```http
Authorization: Bearer mcr_...
Content-Type: application/json
```

Тело JSON-RPC:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "<tool_name>",
    "arguments": { ... }
  }
}
```

### А. Создание и двухфазная публикация объявления

```python
async def publish_listing_pipeline(mcr_key: str, draft: dict) -> str:
    # Шаг 1: Создание черновика (draft)
    create_res = await mcp_call(mcr_key, "create_listing", {
        "title": draft["title"],
        "description": draft["description"],
        "category": draft["category"],
        "kind": draft["kind"],                    # "request" или "offer"
        "locality": draft["locality"],            # Обязательное поле
        "price_rubles": draft.get("price_rubles", 0),
        "modes": ["pickup", "online"]
    })
    listing = create_res["created_listing"]
    listing_id = listing["id"]
    revision = listing["revision"]

    # Шаг 2: Предпросмотр и выпуск токена согласия (Consent Token)
    preview_res = await mcp_call(mcr_key, "preview_listing", {
        "listing_id": listing_id
    })
    consent_token = preview_res["consent_token"]

    # Шаг 3: Фиксация публикации в публичном каталоге с CAS-проверкой
    publish_res = await mcp_call(mcr_key, "publish_listing", {
        "listing_id": listing_id,
        "consent_token": consent_token,
        "revision": revision
    })
    return listing_id
```

### Б. Семантический матчинг (Поиск встречных предложений)

Инструмент `match_listings` выполняет асимметричный семантический поиск через Google Embeddings (`text-embedding-004`):

```python
async def match_user_listing(mcr_key: str, listing: dict) -> list[dict]:
    # Для запроса ("request") ищем встречные предложения ("offer") и наоборот
    target_kind = "offer" if listing["kind"] == "request" else "request"
    
    res = await mcp_call(mcr_key, "match_listings", {
        "query": f"{listing['title']}. {listing['description']}",
        "query_kind": target_kind,
        "category": listing["category"],
        "locality": listing.get("locality"),
        "limit": 5
    })
    return res.get("matches", [])
```

### В. Открытие комнаты и чат

Когда найдено совпадение или пользователь хочет связаться с автором объявления:

```python
# 1. Открытие приватной комнаты
room_res = await mcp_call(mcr_key, "join_room", {
    "listing_id": target_listing_id,
    "visibility": "private",
    "initial_message": "Здравствуйте! Увидел ваше объявление в Хотелке, готов обсудить."
})
room_id = room_res["room_id"]

# 2. Отправка последующих сообщений пользователем
await mcp_call(mcr_key, "send_message", {
    "room_id": room_id,
    "role": "human",
    "text": user_text
})

# 3. Получение истории переписки
history = await mcp_call(mcr_key, "get_room_history", {
    "room_id": room_id
})
```

### Г. Автоматические структурированные переговоры (Negotiator)

Для категорий с явным торгом (услуги, подряд, B2B, аренда) бот может запустить сценарий согласования оферты:

```python
negotiation_res = await mcp_call(mcr_key, "negotiate_agreement", {
    "goal": "Договориться о разработке лендинга под ключ",
    "target_listing_id": target_listing_id,
    "mode": "live",
    "proposed_terms": {
        "price": "60 000 руб.",
        "schedule": "до 25 ноября",
        "location": "Удаленно",
        "guarantees": "Поэтапная оплата 30/70",
        "sla": "Правки в течение 48 часов"
    }
})
```

---

## 6. Управление идентификацией и ключами (`mcr_...`)

Каждому пользователю Telegram выделяется собственный изолированный принципал в Marketplace OS.

### Правила формирования Principal ID
В [server/auth.ts](file:///workspace/mcp-rooms-googleai-2/server/auth.ts) действует регулярное выражение `^(user|agent|org):[a-z0-9][a-z0-9._-]{1,63}$`.  
Следовательно, идентификатор формируется в формате:
```
user:tg-<telegram_user_id>
```
*Пример:* `user:tg-84920194`

### Варианты выдачи ключей
1. **Рекомендуемый (REST-эндпоинт в бэкенде):**  
   Защищённый админ-эндпоинт `POST /api/auth/register-bot-user` с секретом `BOT_REGISTRATION_SECRET`, возвращающий `{ key: "mcr_...", principalId: "user:tg-..." }`.
2. **Альтернативный (CLI при сожительстве на сервере):**  
   Вызов `npm run key:issue -- --principal user:tg-<id> --name "tg-user-<id>"`.

Ключ сохраняется в таблице бота `bot_users` и используется во всех последующих запросах от имени этого пользователя.

---

## 7. Event-Driven матчинг вместо Cron

Вместо тяжелого поллинга каждые 6 часов архитектура опирается на **Webhooks** платформы Marketplace OS:

```
Новое объявление на платформе
             │
             ▼
[Marketplace OS Core] ──> emit: listing.published
             │
             ▼ Webhook POST /webhook/mcp (HMAC-SHA256)
[Telegram Bot Backend]
             │
             ▼
1. Проверка подписи X-MCP-Signature
2. Вызов match_listings по активным хотелкам пользователей
3. Проверка seen_matches (дедупликация)
4. Мгновенный Push в Telegram:
   «Найдено совпадение для вашего запроса!
    [Карточка контрагента]
    [💬 Начать диалог в боте] [🤖 Запустить торг]»
```

---

## 8. Монетизация и GTM-стратегия

### Модель монетизации
- **Freemium-лимит:** До 3 активных объявлений бесплатно.
- **Платный безлимит:** Оплата подписки на 30 дней через **Telegram Stars** (нативная оплата в 1 клик, не требующая сторонних платежных шлюзов).
- **Trigger-moment:** Предложение оплатить Stars выводится не на старте, а в момент попытки опубликовать 4-е объявление.

### Рекомендуемые вертикали для запуска
1. **«Ищу сооснователя / фаундера» (категория `business` / `jobs`):**  
   Высокая ценность контакта, аудитория готова ждать точного совпадения, нет регуляторных рисков.
2. **«Подрядчики и мастера для малого бизнеса» (категория `services`):**  
   Высокий средний чек, явная ценность структурированного торга через `negotiate_agreement`.
3. **«Аренда без риелторов» (категория `real_estate`):**  
   Максимальная боль пользователей, высокая виральность сарафанного радио.

---

## 9. План запуска MVP отдельного репозитория

| День | Задача | Результат |
| :---: | :--- | :--- |
| **День 1** | Инициализация репозитория `kotelka-bot`, каркас aiogram 3, SQLite-хранилище, команды `/start`, `/help`, `/my_listings`. | Работающий бот с регистрацией ключа. |
| **День 2** | Интеграция Gemini Flash, промпт экстрактора, генерация JSON на 20 эталонных фразах. | Стабильный парсинг произвольного текста в черновик. |
| **День 3** | Клиент MCP (`httpx`), цепочка `create_listing` → `preview_listing` → `publish_listing`. | Реальная публикация объявления в Marketplace OS. |
| **День 4** | Webhook-ресивер событий `listing.published` и алгоритм дедупликации `seen_matches`. | Мгновенные пуш-уведомления о совпадениях. |
| **День 5** | Интеграция переписки в Telegram (`join_room`, `send_message`, `get_room_history`). | Пользователи общаются через бота без перехода в браузер. |
| **День 6** | Подключение оплаты через Telegram Stars при превышении лимита 3 объявлений. | Готовый механизм монетизации. |
| **День 7** | E2E-тестирование на контрольной группе, полировка текстов и запуск. | Публичный релиз в Telegram-каналах. |
