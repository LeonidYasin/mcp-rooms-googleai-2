import React, { useEffect, useState } from 'react';
import { Listing, McpRoom, McpMessage } from '../types';
import { callMcpTool, listMcpTools, McpToolInfo } from '../lib/mcpClient';
import { getStoredApiKey } from '../lib/api';

interface McpConsoleProps {
  listings: Listing[];
  rooms: McpRoom[];
  onAddListing: (listing: Listing) => void;
  onSendMessageToRoom: (roomId: string, message: McpMessage) => void;
  onOpenListing: (listing: Listing) => void;
}

interface ToolLogEntry {
  tool: string;
  timestamp: number;
  request: unknown;
  ok: boolean;
  durationMs: number;
  response?: unknown;
  error?: string;
}

export const McpConsole: React.FC<McpConsoleProps> = ({
  listings,
  rooms,
  onSendMessageToRoom,
  onOpenListing,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || '');
  const [newMessageText, setNewMessageText] = useState('');
  const [activeRole, setActiveRole] = useState<'human' | 'agent'>('agent');

  const [tools, setTools] = useState<McpToolInfo[]>([]);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string>('');
  const [toolParamsInput, setToolParamsInput] = useState<string>('{}');
  const [isRunning, setIsRunning] = useState(false);
  const [toolExecutionLog, setToolExecutionLog] = useState<ToolLogEntry[]>([]);

  const currentRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0];

  const defaultArgsFor = (name: string): Record<string, unknown> => {
    switch (name) {
      case 'search_listings':
        return { query: '', category: 'all', kind: 'all', locality: '' };
      case 'match_listings':
        return { query: 'ищу коворкинг в Казани', query_kind: 'request', limit: 5 };
      case 'get_profile':
        return { profile_id: 'user:founder-alex' };
      case 'get_embedding_status':
        return {};
      case 'create_listing':
        return {
          title: 'Горный велосипед GT Avalanche',
          description: 'Размер L, 2021 год, обслужен, есть небольшие царапины.',
          category: 'things',
          kind: 'offer',
          locality: 'Казань',
          price_rubles: 35000,
          modes: ['pickup'],
          condition: 'Б/у, рабочее',
        };
      case 'join_room':
        // No buyer/sender fields: the server takes them from the key.
        return { listing_id: listings[0]?.id || '', initial_message: '' };
      case 'send_message':
        return { room_id: currentRoom?.id || '', role: 'agent', text: '' };
      case 'get_room_history':
        return { room_id: currentRoom?.id || '' };
      case 'negotiate_agreement':
        return { goal: 'Договориться об аренде коворкинга в Казани' };
      default:
        return {};
    }
  };

  // The tool list comes from the server manifest, not from a hardcoded list.
  useEffect(() => {
    let cancelled = false;
    listMcpTools()
      .then((loaded) => {
        if (cancelled) return;
        setTools(loaded);
        setToolsError(null);
        if (loaded.length > 0) {
          setActiveTool((current) => current || loaded[0].name);
          setToolParamsInput((current) =>
            current === '{}' ? JSON.stringify(defaultArgsFor(loaded[0].name), null, 2) : current
          );
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        setToolsError(err?.message || String(err));
      });
    return () => {
      cancelled = true;
    };
    // defaultArgsFor depends on current props; loading the list once is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendRoomMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !currentRoom) return;

    const newMsg: McpMessage = {
      id: 'msg-' + Date.now(),
      roomId: currentRoom.id,
      sender: activeRole === 'agent' ? 'agent:mcp-assistant' : 'user:participant',
      role: activeRole,
      text: newMessageText.trim(),
      timestamp: Date.now(),
    };

    onSendMessageToRoom(currentRoom.id, newMsg);
    setNewMessageText('');
  };

  const handleExecuteTool = async () => {
    if (!activeTool || isRunning) return;

    let parsedParams: Record<string, unknown>;
    try {
      parsedParams = JSON.parse(toolParamsInput || '{}');
    } catch {
      setToolExecutionLog((prev) => [
        {
          tool: activeTool,
          timestamp: Date.now(),
          request: toolParamsInput,
          ok: false,
          durationMs: 0,
          error: 'Параметры должны быть валидным JSON — вызов не отправлен',
        },
        ...prev,
      ]);
      return;
    }

    setIsRunning(true);
    const outcome = await callMcpTool(activeTool, parsedParams);
    setIsRunning(false);

    setToolExecutionLog((prev) => [
      {
        tool: activeTool,
        timestamp: Date.now(),
        request: parsedParams,
        ok: outcome.ok,
        durationMs: outcome.durationMs,
        response: outcome.data,
        error: outcome.error,
      },
      ...prev,
    ]);
  };

  const activeToolInfo = tools.find((t) => t.name === activeTool);

  return (
    <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-8 space-y-8">
      {/* Introduction Banner */}
      <div className="border border-[var(--line)] rounded-2xl p-6 bg-[var(--surface)] shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h1 className="text-2xl font-bold text-[var(--ink)]">
              Интерактивная консоль MCP Rooms
            </h1>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full font-semibold ${
              toolsError
                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                : 'bg-[var(--greenbg)] text-[var(--green)]'
            }`}
          >
            {toolsError
              ? `MCP недоступен: ${toolsError}`
              : `MCP: ${tools.length} инструментов · POST /mcp`}
          </span>
        </div>
        <p className="text-sm text-[var(--muted)] leading-relaxed max-w-3xl">
          Консоль вызывает инструменты на сервере через JSON-RPC <code>POST /mcp</code> и показывает
          ответ как есть. Список инструментов загружается из манифеста сервера; ничего не
          имитируется в браузере.
        </p>
        {toolsError && (
          <p className="text-xs text-red-700 dark:text-red-300 mt-2">
            Не удалось получить <code>tools/list</code>. Проверьте, что сервер запущен.
          </p>
        )}
        {!getStoredApiKey() && (
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
            Ключ не задан: <code>tools/list</code> открыт, но <code>tools/call</code> вернёт 401.
            Нажмите 🔑 в шапке и вставьте ключ, выданный командой <code>npm run auth -- key issue --user user:… --name "…"</code>.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Room Conversation */}
        <div className="border border-[var(--line)] rounded-2xl bg-[var(--canvas)] flex flex-col h-[650px] shadow-xs">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--surface)] rounded-t-2xl flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">
                💬 Комната переговоров (Shared Room)
              </h2>
              <div className="text-xs text-[var(--muted)] mt-0.5">
                Переписка покупателя, продавца и AI-ассистента
              </div>
            </div>
            {currentRoom?.listingId && (
              <button
                type="button"
                onClick={() => {
                  const item = listings.find((l) => l.id === currentRoom.listingId);
                  if (item) onOpenListing(item);
                }}
                className="text-xs text-[var(--blue)] hover:underline"
              >
                Карточка →
              </button>
            )}
          </div>

          {/* Messages list */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-sm bg-[var(--canvas)]">
            {!currentRoom && (
              <div className="text-xs text-[var(--muted)] leading-relaxed">
                Комнат нет: они создаются инструментом <code>join_room</code> и видны только
                участникам. Без ключа список комнат пуст — это ожидаемо.
              </div>
            )}
            {currentRoom?.messages.map((m) => (
              <div
                key={m.id}
                className={`p-3.5 rounded-xl border ${
                  m.role === 'agent'
                    ? 'bg-[var(--soft)] border-blue-200/60 dark:border-blue-900/40 ml-4'
                    : m.role === 'human' && m.sender.includes('buyer')
                    ? 'bg-[var(--surface)] border-[var(--line)] mr-4'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/50 mr-2'
                }`}
              >
                <div className="flex justify-between items-center text-xs text-[var(--muted)] mb-1.5">
                  <span className="font-semibold text-[var(--ink)]">
                    {m.role === 'agent' ? '🤖 AI-Агент (MCP Assistant)' : `👤 ${m.sender}`}
                  </span>
                  <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="text-[var(--ink)] leading-relaxed whitespace-pre-wrap">
                  {m.text}
                </div>
                {m.toolCall && (
                  <div className="mt-2 pt-2 border-t border-[var(--line)] text-xs font-mono text-[var(--muted)]">
                    <span className="text-[var(--blue)] font-bold">MCP Tool Call: </span>
                    {m.toolCall.tool}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Message input */}
          <form onSubmit={handleSendRoomMessage} className="p-3 border-t border-[var(--line)] bg-[var(--surface)] rounded-b-2xl">
            <div className="flex items-center gap-3 mb-2 text-xs">
              <span className="text-[var(--muted)]">Отправить как:</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  checked={activeRole === 'agent'}
                  onChange={() => setActiveRole('agent')}
                />
                <span>🤖 AI-Агент</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  checked={activeRole === 'human'}
                  onChange={() => setActiveRole('human')}
                />
                <span>👤 Человек (Участник)</span>
              </label>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                placeholder={
                  activeRole === 'agent'
                    ? 'Сообщение от лица агента (проверка условий, согласование)...'
                    : 'Ваш вопрос или ответ в комнату...'
                }
                className="flex-1 h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--canvas)] text-sm outline-none"
              />
              <button
                type="submit"
                className="px-4 h-10 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white text-sm font-semibold rounded-lg cursor-pointer transition-colors"
              >
                Отправить
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: MCP tools tester */}
        <div className="border border-[var(--line)] rounded-2xl bg-[var(--canvas)] flex flex-col h-[650px] shadow-xs">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--surface)] rounded-t-2xl">
            <h2 className="text-base font-bold text-[var(--ink)]">
              🛠️ Вызов MCP Tools ({tools.length})
            </h2>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              Реальные <code>tools/call</code> — ответ сервера отображается без изменений
            </div>
          </div>

          <div className="p-4 border-b border-[var(--line)] space-y-3 bg-[var(--surface)]">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">
                Выберите MCP Инструмент
              </label>
              <select
                value={activeTool}
                disabled={tools.length === 0}
                onChange={(e) => {
                  const tool = e.target.value;
                  setActiveTool(tool);
                  setToolParamsInput(JSON.stringify(defaultArgsFor(tool), null, 2));
                }}
                className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--canvas)] text-sm outline-none disabled:opacity-60"
              >
                {tools.length === 0 && <option value="">— манифест недоступен —</option>}
                {tools.map((tool) => (
                  <option key={tool.name} value={tool.name}>
                    {tool.name}
                  </option>
                ))}
              </select>
              {activeToolInfo?.description && (
                <p className="text-[11px] text-[var(--muted)] mt-1 leading-snug">{activeToolInfo.description}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-[var(--muted)] uppercase">
                  Параметры вызова (JSON)
                </label>
                <button
                  type="button"
                  onClick={handleExecuteTool}
                  disabled={!activeTool || isRunning}
                  className="px-3 py-1 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white text-xs font-bold rounded-md cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isRunning ? 'Выполняется…' : 'Выполнить tool call →'}
                </button>
              </div>
              <textarea
                rows={5}
                value={toolParamsInput}
                onChange={(e) => setToolParamsInput(e.target.value)}
                className="w-full p-2 text-xs font-mono border border-[var(--line)] rounded-lg bg-[var(--canvas)] text-[var(--ink)] outline-none"
              />
            </div>
          </div>

          {/* Results execution log */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs bg-[var(--canvas)]">
            <div className="text-[var(--muted)] font-semibold text-[11px] uppercase tracking-wider mb-2">
              Лог ответов сервера (Execution Receipts):
            </div>
            {toolExecutionLog.length === 0 && (
              <div className="text-[var(--muted)] text-[11px]">
                Журнал пуст: вызовите инструмент, чтобы увидеть ответ сервера.
              </div>
            )}
            {toolExecutionLog.map((log, idx) => (
              <div key={idx} className="p-3 border border-[var(--line)] rounded-xl bg-[var(--surface)] space-y-1.5">
                <div className="flex justify-between text-[var(--muted)]">
                  <span className="text-[var(--blue)] font-bold">{log.tool}</span>
                  <span>
                    {log.ok ? 'ok' : 'error'} · {log.durationMs} ms ·{' '}
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-[var(--ink)] space-y-1">
                  <pre className="text-[11px] overflow-x-auto p-2 bg-[var(--canvas)] rounded border border-[var(--line)]">
                    {JSON.stringify({ request: log.request }, null, 2)}
                  </pre>
                  <pre
                    className={`text-[11px] overflow-x-auto p-2 rounded border ${
                      log.ok
                        ? 'bg-[var(--canvas)] border-[var(--line)]'
                        : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-200'
                    }`}
                  >
                    {log.ok
                      ? JSON.stringify(log.response, null, 2)
                      : JSON.stringify({ error: log.error, response: log.response }, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
