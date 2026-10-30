import React, { useState } from 'react';

interface McpIntegrationGuideProps {
  serverUrl?: string;
  onClose?: () => void;
}

export const McpIntegrationGuide: React.FC<McpIntegrationGuideProps> = ({
  serverUrl = typeof window !== 'undefined' ? window.location.origin : 'https://leonid-mcp.duckdns.org',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'claude' | 'cursor' | 'chatgpt' | 'scripts'>('claude');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const mcpEndpoint = `${serverUrl}/mcp`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const claudeConfigJson = JSON.stringify(
    {
      mcpServers: {
        'mcp-rooms': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-fetch', mcpEndpoint],
        },
      },
    },
    null,
    2
  );

  const directMcpJson = JSON.stringify(
    {
      mcpServers: {
        'mcp-rooms': {
          url: mcpEndpoint,
        },
      },
    },
    null,
    2
  );

  const curlExample = `# 1. Проверить доступные инструменты MCP:
curl -s -X POST "${mcpEndpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 2. Вызвать поиск объявлений (search_listings):
curl -s -X POST "${mcpEndpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "search_listings",
      "arguments": {
        "query": "коворкинг",
        "locality": "Казань"
      }
    }
  }'

# 3. Вызвать асимметричный семантический матчинг (match_listings):
curl -s -X POST "${mcpEndpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "match_listings",
      "arguments": {
        "query": "Ищу коворкинг для команды из 3 человек",
        "locality": "Казань",
        "limit": 3
      }
    }
  }'`;

  const pythonExample = `import requests

MCP_URL = "${mcpEndpoint}"

def call_mcp_tool(tool_name: str, arguments: dict):
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    }
    response = requests.post(MCP_URL, json=payload)
    response.raise_for_status()
    return response.json()

# Пример: поиск коворкингов или партнеров
result = call_mcp_tool("match_listings", {
    "query": "Ищу разработчика TypeScript в стартап",
    "locality": "Казань",
    "limit": 5
})

print("Ответ MCP:", result["result"]["content"][0]["text"])`;

  const openApiYaml = `openapi: 3.1.0
info:
  title: MCP Rooms Marketplace API
  description: Каталог объявлений и семантический матчинг площадки «Хочу · Предлагаю»
  version: 1.0.0
servers:
  - url: ${serverUrl}
paths:
  /api/listings:
    get:
      operationId: getListings
      summary: Поиск объявлений в каталоге
      parameters:
        - name: query
          in: query
          schema:
            type: string
          description: Ключевые слова
        - name: category
          in: query
          schema:
            type: string
          description: Категория (business, jobs, services, real_estate, communities)
        - name: locality
          in: query
          schema:
            type: string
          description: Город (Казань, Москва и др.)
      responses:
        '200':
          description: Список карточек
  /api/match:
    post:
      operationId: matchNeedsOffers
      summary: Асимметричный матчинг (поиск пары Хочу <-> Предлагаю)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                query:
                  type: string
                locality:
                  type: string
                limit:
                  type: integer
      responses:
        '200':
          description: Результаты ранжирования`;

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 md:p-6 space-y-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xl shadow-xs">
            🔌
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold text-[var(--ink)]">
              Подключение внешних ИИ к MCP инструментам
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Используйте ваш привычный Claude, ChatGPT, Cursor или скрипты для управления площадкой через MCP
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] text-xl font-bold cursor-pointer p-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 text-xs border-b border-[var(--line)] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('claude')}
          className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
            activeTab === 'claude'
              ? 'bg-[var(--blue)] text-white shadow-xs'
              : 'bg-[var(--canvas)] hover:bg-[var(--raised)] text-[var(--ink)] border border-[var(--line)]'
          }`}
        >
          🟣 Claude Desktop
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cursor')}
          className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
            activeTab === 'cursor'
              ? 'bg-[var(--blue)] text-white shadow-xs'
              : 'bg-[var(--canvas)] hover:bg-[var(--raised)] text-[var(--ink)] border border-[var(--line)]'
          }`}
        >
          ⚡ Cursor / Windsurf / Cline
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chatgpt')}
          className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
            activeTab === 'chatgpt'
              ? 'bg-[var(--blue)] text-white shadow-xs'
              : 'bg-[var(--canvas)] hover:bg-[var(--raised)] text-[var(--ink)] border border-[var(--line)]'
          }`}
        >
          🟢 ChatGPT (Custom GPT)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('scripts')}
          className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
            activeTab === 'scripts'
              ? 'bg-[var(--blue)] text-white shadow-xs'
              : 'bg-[var(--canvas)] hover:bg-[var(--raised)] text-[var(--ink)] border border-[var(--line)]'
          }`}
        >
          🐍 Python / cURL / API
        </button>
      </div>

      {/* Tab 1: Claude Desktop */}
      {activeTab === 'claude' && (
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 rounded-xl space-y-1.5">
            <h4 className="font-bold text-indigo-900 dark:text-indigo-300">
              Как подключить официальный десктопный Claude к вашей площадке:
            </h4>
            <p className="text-[var(--muted)] leading-relaxed">
              Откройте файл конфигурации Claude Desktop (в меню настроек Claude: <em>Settings ➔ Developer ➔ Edit Config</em>)
              и добавьте сервер <code>mcp-rooms</code>. Claude автоматически получит инструменты поиска, создания объявлений и матчинга!
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--muted)]">
              <span>Конфигурация claude_desktop_config.json (рекомендуется через npx proxy):</span>
              <button
                type="button"
                onClick={() => copyToClipboard(claudeConfigJson, 'claude')}
                className="px-2.5 py-1 bg-[var(--blue)] text-white rounded-md hover:bg-[var(--blue-hover)] cursor-pointer font-bold transition shadow-xs"
              >
                {copiedKey === 'claude' ? '✓ Скопировано!' : 'Скопировать JSON'}
              </button>
            </div>
            <pre className="p-3 bg-[var(--canvas)] border border-[var(--line)] rounded-xl font-mono text-[11px] overflow-x-auto text-[var(--ink)]">
              {claudeConfigJson}
            </pre>
          </div>

          <div className="p-3 bg-[var(--canvas)] border border-[var(--line)] rounded-xl space-y-1">
            <strong className="text-[var(--ink)] block">Что вы сможете спросить у Claude:</strong>
            <p className="text-[var(--muted)]">• <em>«Найди в MCP Rooms коворкинг в центре Казани и покажи подходящие варианты»</em></p>
            <p className="text-[var(--muted)]">• <em>«Найди в базе кандидатов на вакансию Senior TypeScript разработчика»</em></p>
            <p className="text-[var(--muted)]">• <em>«Опубликуй новое предложение об аренде офиса на 5 человек»</em></p>
          </div>
        </div>
      )}

      {/* Tab 2: Cursor / Windsurf / Cline */}
      {activeTab === 'cursor' && (
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-xl space-y-1.5">
            <h4 className="font-bold text-purple-900 dark:text-purple-300">
              Подключение в редакторах кода (Cursor, Windsurf, Cline):
            </h4>
            <p className="text-[var(--muted)] leading-relaxed">
              В Cursor или Windsurf откройте <em>Settings ➔ Features ➔ MCP Servers ➔ Add New MCP Server</em>.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--muted)]">
              <span>Прямой HTTP MCP Endpoint (Streamable HTTP):</span>
              <button
                type="button"
                onClick={() => copyToClipboard(mcpEndpoint, 'mcpEndpoint')}
                className="px-2.5 py-1 bg-[var(--blue)] text-white rounded-md hover:bg-[var(--blue-hover)] cursor-pointer font-bold transition shadow-xs"
              >
                {copiedKey === 'mcpEndpoint' ? '✓ Скопировано!' : 'Скопировать URL'}
              </button>
            </div>
            <div className="p-3 bg-[var(--canvas)] border border-[var(--line)] rounded-xl font-mono text-xs text-sky-600 dark:text-sky-400 font-bold">
              {mcpEndpoint}
            </div>
            <div className="text-[11px] text-[var(--muted)] leading-relaxed">
              💡 <em>Для плагинов и клиентов с форматом SSE также поддерживается эндпоинт:</em>{' '}
              <code className="text-sky-600 dark:text-sky-400">{`${serverUrl}/sse`}</code>
            </div>
            <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg text-[11px] text-[var(--ink)] leading-relaxed">
              <strong>Аутентификация (Bearer Token):</strong> Метод рукопожатия <code>initialize</code> и получение списка инструментов <code>tools/list</code> работают <strong>без токена</strong>. Для вызова инструментов (<code>tools/call</code>) передавайте заголовок <code>Authorization: Bearer &lt;ваш_ключ&gt;</code> (нажмите 🔑 в шапке сайта для копирования).
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--muted)]">
              <span>Или конфигурация для mcp.json:</span>
              <button
                type="button"
                onClick={() => copyToClipboard(directMcpJson, 'directMcp')}
                className="px-2.5 py-1 bg-[var(--blue)] text-white rounded-md hover:bg-[var(--blue-hover)] cursor-pointer font-bold transition shadow-xs"
              >
                {copiedKey === 'directMcp' ? '✓ Скопировано!' : 'Скопировать JSON'}
              </button>
            </div>
            <pre className="p-3 bg-[var(--canvas)] border border-[var(--line)] rounded-xl font-mono text-[11px] overflow-x-auto text-[var(--ink)]">
              {directMcpJson}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 3: ChatGPT Custom GPT */}
      {activeTab === 'chatgpt' && (
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl space-y-1.5">
            <h4 className="font-bold text-emerald-900 dark:text-emerald-300">
              Подключение в ChatGPT (Custom GPTs / Actions):
            </h4>
            <p className="text-[var(--muted)] leading-relaxed">
              Создайте Custom GPT на сайте <em>chatgpt.com/gpts/editor</em>, перейдите в раздел <strong>Actions</strong> и вставьте готовую схему OpenAPI ниже. ChatGPT сможет искать объявления на вашей площадке напрямую!
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--muted)]">
              <span>OpenAPI 3.1 Schema для ChatGPT Action:</span>
              <button
                type="button"
                onClick={() => copyToClipboard(openApiYaml, 'openapi')}
                className="px-2.5 py-1 bg-[var(--blue)] text-white rounded-md hover:bg-[var(--blue-hover)] cursor-pointer font-bold transition shadow-xs"
              >
                {copiedKey === 'openapi' ? '✓ Скопировано!' : 'Скопировать OpenAPI YAML'}
              </button>
            </div>
            <pre className="p-3 bg-[var(--canvas)] border border-[var(--line)] rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 text-[var(--ink)]">
              {openApiYaml}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 4: Python & cURL scripts */}
      {activeTab === 'scripts' && (
        <div className="space-y-4 text-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--muted)]">
              <span>Примеры cURL (Bash):</span>
              <button
                type="button"
                onClick={() => copyToClipboard(curlExample, 'curl')}
                className="px-2.5 py-1 bg-[var(--blue)] text-white rounded-md hover:bg-[var(--blue-hover)] cursor-pointer font-bold transition shadow-xs"
              >
                {copiedKey === 'curl' ? '✓ Скопировано!' : 'Скопировать cURL'}
              </button>
            </div>
            <pre className="p-3 bg-[var(--canvas)] border border-[var(--line)] rounded-xl font-mono text-[11px] overflow-x-auto text-[var(--ink)] max-h-60">
              {curlExample}
            </pre>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--muted)]">
              <span>Пример скрипта Python (requests):</span>
              <button
                type="button"
                onClick={() => copyToClipboard(pythonExample, 'python')}
                className="px-2.5 py-1 bg-[var(--blue)] text-white rounded-md hover:bg-[var(--blue-hover)] cursor-pointer font-bold transition shadow-xs"
              >
                {copiedKey === 'python' ? '✓ Скопировано!' : 'Скопировать Python'}
              </button>
            </div>
            <pre className="p-3 bg-[var(--canvas)] border border-[var(--line)] rounded-xl font-mono text-[11px] overflow-x-auto text-[var(--ink)] max-h-60">
              {pythonExample}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
