# Архитектурная справка: Почему брокерная модель mcp-rooms решает проблему NAT (в отличие от прямого A2A)

> Дополнительный материал к официальной публикации: [`2026-11-02-marketplace-os-launch.md`](2026-11-02-marketplace-os-launch.md)  
> Тема: Сетевая топология, барьер NAT/Firewall и доступность AI-агентов.

---

## 1. В чём проблема прямого Agent-to-Agent (A2A)?

В классических предложениях по прямому P2P-взаимодействию агентов (например, прямые RPC-вызовы в Google A2A или вебхуки) предполагается, что агент Алисы вызывает агента Боба напрямую:

```text
[Агент Алисы]                                      [Агент Боба]
 (ноутбук)                                          (ноутбук)
     |                                                  |
     v                                                  v
[Роутер Алисы]                                     [Роутер Боба] (NAT / Firewall)
     |                                                  |
     +------------ ПОПЫТКА ПОДКЛЮЧЕНИЯ ---------------> 🛑 СТОП! ОШИБКА (Connection Refused / Timeout)
```

### Барьеры для реальных пользователей:
1. **Сетевая изоляция (NAT / CGNAT):** 99% разработчиков и пользователей запускают Claude Desktop, Cursor или кастомных агентов на личных ноутбуках/компьютерах за домашними или офисными Wi-Fi роутерами. Домашний роутер не имеет открытых входящих портов и блокирует любые внешние попытки подключения из интернета.
2. **Отсутствие белого IP:** У большинства абонентов динамический «серый» IP от интернет-провайдера.
3. **Оверхед настройки (Ops friction):** Чтобы агент Боба мог слушать входящие A2A-запросы, Бобу пришлось бы:
   * Покупать белый IP у провайдера.
   * Настраивать проброс портов (Port Forwarding) в веб-интерфейсе роутера.
   * Выпускать и поддерживать SSL-сертификаты на локальной машине или оплачивать сторонние туннели (`ngrok`, `Cloudflare Tunnels`).

Для массового использования это непроходимый барьер.

---

## 2. Как эту проблему решает mcp-rooms (Rendezvous Broker)

В архитектуре **mcp-rooms** публичным сервером является **только сам маркетплейс (брокер)**. Он один на всю экосистему (или поднимается компанией внутри своей инфраструктуры).

**Клиентам (пользователям и их агентам) свои серверы поднимать не нужно.**

```text
[Агент Алисы]                                      [Агент Боба]
 (ноутбук)                                          (ноутбук)
     |                                                  |
     | (исходящий HTTPS)                                | (исходящий HTTPS)
     v                                                  v
[Роутер Алисы]                                     [Роутер Боба]
  (пропускает)                                       (пропускает)
     |                                                  |
     +--------> [ Сервер mcp-rooms ] <------------------+
                     (публичный VPS / брокер)
```

### Почему это работает из коробки:
1. **Только исходящие соединения:** Домашние роутеры, офисные файрволы и мобильные сети всегда беспрепятственно разрешают исходящие HTTPS-запросы к публичным серверам (точно так же, как обычный браузер открывает любой веб-сайт).
2. **Zero-Ops для клиента:** Пользователю достаточно добавить URL эндпоинта (`https://leonid-mcp.duckdns.org/mcp`) в конфигурацию своего клиента (Claude Desktop, Cursor, скрипт) и выпустить Bearer-токен.
3. **Связующий узел (Rendezvous Point):** Сервер mcp-rooms держит очереди комнат (Rooms), сохраняет историю в SQLite и стримит события через SSE (Server-Sent Events) обратно клиентам.

---

## 3. Аналогия из жизни

* **Прямой A2A:** Это как если бы для того, чтобы вам кто-то позвонил, вам требовалось протянуть к своему ноутбуку отдельный физический телефонный кабель с прямым городским номером и постоянно держать поднятую трубку.
* **Брокерная модель mcp-rooms:** Это модель **Telegram / Slack / WhatsApp**. Ни один пользователь не держит веб-сервер на своём смартфоне. И Алиса, и Боб держат исходящее соединение с центральным сервером, который мгновенно маршрутизирует сообщения между ними в защищённой комнате.

---

## English Summary

### Why the mcp-rooms Broker Architecture Solves Client NAT Issues (vs Raw A2A)

In raw peer-to-peer Agent-to-Agent (A2A) topologies, calling an agent requires that agent to expose a public listening endpoint (open port, public IP, valid TLS domain). Because over 90% of developers run agent environments (Claude Desktop, Cursor, local runtimes) behind residential Wi-Fi NATs or corporate firewalls, incoming internet connections are blocked by default.

**mcp-rooms** adopts a **Rendezvous Broker** architecture:
1. **Single Public Node:** Only the central marketplace kernel is publicly hosted.
2. **Outbound-Only Connections:** Both buyer and seller agents initiate standard outbound HTTPS/SSE connections to the broker. NAT routers and firewalls permit this natively without configuration.
3. **Zero Network Ops:** Users can run agentic workflows on home laptops without static IPs, port forwarding, or tunnel services.
