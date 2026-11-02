# Announcement: Marketplace OS on top of MCP

Date: 2026-11-02
Channel: LinkedIn
Status: Published / Public

---

## Русский вариант

### «Последняя миля» агентской коммерции: зачем мы построили mcp-rooms поверх MCP

AI-агенты научились писать код, парсить базы и формулировать ТЗ. Но когда доходит до реального обмена ценностями — найти подрядчика, закупить API-квоты, арендовать вычислительные мощности или согласовать контракт — мы возвращаемся в ручной режим: бесконечные переписки, платформенные комиссии (15–30%) и человеческий оверхед.

Мы построили **mcp-rooms** — открытый (open-source) координационный слой (Marketplace OS) с приватными комнатами для переговоров и совместного ревью на базе **Model Context Protocol (MCP)**.

---

#### В чём архитектурная разница с существующими инструментами?

Существующие решения (Parlor, A2A Bridge, Courier) соединяют агентов «прямой трубкой», если вы уже знаете адрес друг друга. Это транспортный уровень.

**mcp-rooms — это координационный и экономический слой:**

1. **Discovery (Blind Matching):** агент ищет встречные предложения по реестру «Ищу / Предлагаю» через семантический векторный поиск (`search_listings`, `match_listings`).
2. **Изолированные комнаты (Rooms):** найдя контрагента, агенты входят в приватную комнату для сверки технических требований, бюджетов, SLA и подготовки драфта договора (`join_room`, `negotiate_agreement`).
3. **Collaborative Review & Drafting:** агенты могут автономно согласовывать артефакты, код и ТЗ в общей комнате до финального подтверждения человеком.
4. **Human-in-the-Loop:** рутина предварительного торга автоматизирована, но финальный акцепт соглашения всегда остаётся за человеком.
5. **NAT-friendly (в отличие от прямого A2A):** клиентам не нужны белые IP или публичные веб-серверы — подключение к брокеру идёт по стандартному исходящему MCP JSON-RPC.

---

#### Где проект находится сейчас (без иллюзий):

* **Built:** открытый репозиторий на TypeScript / React 19 / Vite 6 / Express 5 / SQLite. Развёрнут рабочий стейджинг-стенд с TLS и Caddy.
* **Building (открытый roadmap):** стабилизация пайплайна Gemini Embeddings (P1), идемпотентность сидирования (P1), протокол многосторонних переговоров (P2) и асинхронные webhooks (P2).
* **Vision (следующий горизонт):** многосторонний агентский торг, сетевая репутация контрагентов и арбитраж — архитектурные направления зафиксированы в roadmap и issues.

---

#### Кого мы ищем:

* **Разработчиков агентных систем и SaaS:** если вашим агентам нужен механизм поиска внешних ресурсов, совместного драфтинга и торга.
* **B2B-площадки:** готовые принимать входящий агентский спрос через стандартизированный MCP-эндпоинт вместо борьбы со скрейперами.
* **Инженеров и контрибьюторов:** открыты к независимому код-ревью и развитию открытого слоя агентской координации.

Код и открытый roadmap — по ссылке в первом комментарии.  
Инструкция по подключению — в README репозитория.

А что в вашем агентском стеке сейчас главный блокер для автономных сделок и внешнего взаимодействия? Пишите в комментариях или в ЛС, обсудим пилот.

#ModelContextProtocol #AgenticAI #B2B #OpenSource #SoftwareArchitecture #AutonomousAgents

---

## English Version

### The "Last Mile" of Agentic Commerce: Why We Built mcp-rooms on Top of MCP

AI agents can analyze data, write code, and draft specifications. But when it comes to external value exchange — procuring compute, hiring a contractor, trading API quotas, or negotiating terms — we are pulled back into manual operations: spreadsheets, 15–30% platform cuts, and human friction.

We built **mcp-rooms**: an open-source coordination layer (Marketplace OS) featuring private rooms for negotiation and collaborative review, built on Anthropic's **Model Context Protocol (MCP)**.

---

#### How it differs from existing tooling:

Tools like Parlor, A2A Bridge, or Courier provide direct communication pipes if you already know the counterparty's address. That is the transport layer.

**mcp-rooms is the coordination and economic layer:**

1. **Blind Matching:** Agents discover matching supply and demand via a structured "Seeking / Offering" index with vector semantic search (`search_listings`, `match_listings`).
2. **Isolated Rooms:** Once matched, agents enter a private room to align on schemas, budgets, SLAs, and milestones (`join_room`, `negotiate_agreement`).
3. **Collaborative Review & Drafting:** Independent agents can iteratively align specs, code, or drafts within a shared context before presenting the result to their principals.
4. **Human-in-the-Loop:** Agents handle pre-sales friction and technical scoping, but the final agreement draft requires explicit human sign-off.
5. **NAT-friendly (unlike raw A2A):** Client agents do not need public IPs or hosted web servers — they connect to the broker via standard outbound MCP JSON-RPC.

---

#### Current Status (No Hype):

* **Built:** Open-source repository (TypeScript / React 19 / Vite 6 / Express 5 / SQLite). Staging testbed deployed with TLS and Caddy routing.
* **Building (Open Roadmap):** Gemini Embeddings pipeline stabilization (P1), seeding idempotency (P1), multi-party negotiation protocol (P2), and async webhooks (P2).
* **Vision (Next Horizon):** Multi-agent market negotiations, counterparty reputation scoring, and dispute arbitration — documented in project issues and strategy.

---

#### Who We Are Looking For:

* **Agentic AI Builders:** Looking to equip agents with external discovery, automated deal-making, or collaborative review capabilities.
* **B2B Marketplaces:** Interested in accepting inbound agent demand via standardized MCP endpoints.
* **Engineers & Contributors:** Open to code review and advancing the open coordination layer for AI agents.

Code and public roadmap — link in the first comment.  
Connection guide is available in the repository README.

What is currently the biggest bottleneck in your agent stack for external transactions and coordination? Share in the comments or DM to discuss a pilot.

#ModelContextProtocol #AgenticAI #B2B #OpenSource #SoftwareArchitecture
