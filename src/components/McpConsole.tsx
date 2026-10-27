import React, { useState } from 'react';
import { Listing, McpRoom, McpMessage } from '../types';

interface McpConsoleProps {
  listings: Listing[];
  rooms: McpRoom[];
  onAddListing: (listing: Listing) => void;
  onSendMessageToRoom: (roomId: string, message: McpMessage) => void;
  onOpenListing: (listing: Listing) => void;
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
  const [activeTool, setActiveTool] = useState<string>('preview_publication');
  const [toolParamsInput, setToolParamsInput] = useState<string>(
    JSON.stringify({ listing_id: listings[0]?.id || 'bike-kazan-demo-01' }, null, 2)
  );
  const [toolExecutionLog, setToolExecutionLog] = useState<Array<{
    tool: string;
    timestamp: number;
    request: any;
    response: any;
  }>>([
    {
      tool: 'list_active_listings',
      timestamp: Date.now() - 60000,
      request: { category: 'things', locality: 'Казань' },
      response: {
        total: listings.length,
        items: listings.slice(0, 3).map((l) => ({
          id: l.id,
          title: l.content.title,
          price_rub: l.content.price_minor ? l.content.price_minor / 100 : null,
          modes: l.content.modes,
        })),
      },
    },
  ]);

  const currentRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0];

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

  const handleExecuteTool = () => {
    let parsedParams: any = {};
    try {
      parsedParams = JSON.parse(toolParamsInput);
    } catch {
      alert('Ошибка: параметры инструмента должны быть валидным JSON');
      return;
    }

    let response: any = {};
    const timestamp = Date.now();

    switch (activeTool) {
      case 'create_draft':
        response = {
          status: 'draft_created',
          draft_id: 'draft-' + Math.random().toString(36).substring(2, 8),
          owner: 'user:agent-executor',
          parameters: parsedParams,
          ready_for_preview: true,
        };
        break;
      case 'preview_publication': {
        const found = listings.find((l) => l.id === parsedParams.listing_id) || listings[0];
        response = {
          preview_status: 'valid',
          listing_id: found.id,
          title: found.content.title,
          rendered_card_route: `/market/${found.id}`,
          sanitized_description: found.content.description.substring(0, 100) + '...',
          validation_errors: [],
          ready_to_publish: true,
        };
        break;
      }
      case 'inspect_room':
        response = {
          room_id: currentRoom?.id,
          title: currentRoom?.title,
          participants: currentRoom?.participants,
          total_messages: currentRoom?.messages.length,
          last_active: new Date().toISOString(),
          status: currentRoom?.status,
        };
        break;
      case 'list_active_listings':
        response = {
          count: listings.length,
          listings: listings.map((l) => ({
            id: l.id,
            title: l.content.title,
            category: l.content.category,
            price_rub: l.content.price_minor ? l.content.price_minor / 100 : null,
          })),
        };
        break;
      case 'inspect_room_agreement':
        response = {
          agreement_reached: true,
          mode: 'pickup',
          agreed_city: 'Казань',
          terms_verified: true,
          note: 'Точный адрес для встречи передан участникам приватно.',
        };
        break;
      default:
        response = {
          ok: true,
          executed: activeTool,
          params: parsedParams,
          message: 'Операция успешно обработана в изолированном MCP-контексте',
        };
    }

    setToolExecutionLog((prev) => [
      {
        tool: activeTool,
        timestamp,
        request: parsedParams,
        response,
      },
      ...prev,
    ]);
  };

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
          <span className="text-xs bg-[var(--greenbg)] text-[var(--green)] px-3 py-1 rounded-full font-semibold">
            Протокол: Model Context Protocol (v1.0)
          </span>
        </div>
        <p className="text-sm text-[var(--muted)] leading-relaxed max-w-3xl">
          MCP Rooms позволяет AI-агентам (Claude, Qwen, Cursor и локальным моделям) безопасно взаимодействовать с маркетплейсом: создавать черновики, прикреплять проверенные фото, публиковать карточки и вести переговоры от имени владельца в изолированных комнатах.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Room Conversation Simulation */}
        <div className="border border-[var(--line)] rounded-2xl bg-[var(--canvas)] flex flex-col h-[650px] shadow-xs">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--surface)] rounded-t-2xl flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">
                💬 Комната переговоров (Shared Room)
              </h2>
              <div className="text-xs text-[var(--muted)] mt-0.5">
                Изолированная переписка покупателя, продавца и AI-ассистента
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

        {/* Right Column: Interactive MCP Tools Tester */}
        <div className="border border-[var(--line)] rounded-2xl bg-[var(--canvas)] flex flex-col h-[650px] shadow-xs">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--surface)] rounded-t-2xl">
            <h2 className="text-base font-bold text-[var(--ink)]">
              🛠️ Тестирование MCP Tools (12 Listing + 8 Room Tools)
            </h2>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              Прямой вызов инструментов спецификации mcp-rooms
            </div>
          </div>

          <div className="p-4 border-b border-[var(--line)] space-y-3 bg-[var(--surface)]">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">
                Выберите MCP Инструмент
              </label>
              <select
                value={activeTool}
                onChange={(e) => {
                  const tool = e.target.value;
                  setActiveTool(tool);
                  if (tool === 'create_draft') {
                    setToolParamsInput(
                      JSON.stringify(
                        {
                          title: 'Горный велосипед GT Avalanche',
                          category: 'things',
                          kind: 'offer',
                          modes: ['pickup'],
                          locality: 'Казань',
                          price_minor: 3500000,
                          currency: 'RUB',
                        },
                        null,
                        2
                      )
                    );
                  } else if (tool === 'preview_publication') {
                    setToolParamsInput(
                      JSON.stringify({ listing_id: listings[0]?.id || 'bike-kazan-demo-01' }, null, 2)
                    );
                  } else if (tool === 'list_active_listings') {
                    setToolParamsInput(
                      JSON.stringify({ category: 'things', locality: 'Казань' }, null, 2)
                    );
                  } else if (tool === 'inspect_room_agreement') {
                    setToolParamsInput(
                      JSON.stringify({ room_id: currentRoom?.id, check_safety: true }, null, 2)
                    );
                  } else {
                    setToolParamsInput(JSON.stringify({ target: 'example' }, null, 2));
                  }
                }}
                className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--canvas)] text-sm outline-none"
              >
                <optgroup label="Listing Tools (Карточки и Черновики)">
                  <option value="preview_publication">preview_publication (Предпросмотр публикации)</option>
                  <option value="create_draft">create_draft (Создание черновика)</option>
                  <option value="list_active_listings">list_active_listings (Список активных)</option>
                  <option value="attach_photo">attach_photo (Прикрепление фото)</option>
                  <option value="publish_listing">publish_listing (Публикация карточки)</option>
                  <option value="withdraw_listing">withdraw_listing (Снятие с публикации)</option>
                </optgroup>
                <optgroup label="Room Tools (Комнаты и Согласование)">
                  <option value="inspect_room">inspect_room (Аудит комнаты)</option>
                  <option value="inspect_room_agreement">inspect_room_agreement (Проверка договорённости)</option>
                  <option value="send_message">send_message (Отправка сообщения)</option>
                  <option value="record_agreement">record_agreement (Фиксация согласия)</option>
                </optgroup>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-[var(--muted)] uppercase">
                  Параметры вызова (JSON)
                </label>
                <button
                  type="button"
                  onClick={handleExecuteTool}
                  className="px-3 py-1 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white text-xs font-bold rounded-md cursor-pointer transition-colors"
                >
                  Выполнить tool call →
                </button>
              </div>
              <textarea
                rows={3}
                value={toolParamsInput}
                onChange={(e) => setToolParamsInput(e.target.value)}
                className="w-full p-2 text-xs font-mono border border-[var(--line)] rounded-lg bg-[var(--canvas)] text-[var(--ink)] outline-none"
              />
            </div>
          </div>

          {/* Results execution log */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs bg-[var(--canvas)]">
            <div className="text-[var(--muted)] font-semibold text-[11px] uppercase tracking-wider mb-2">
              Лог ответов инструмента (Execution Receipts):
            </div>
            {toolExecutionLog.map((log, idx) => (
              <div key={idx} className="p-3 border border-[var(--line)] rounded-xl bg-[var(--surface)] space-y-1.5">
                <div className="flex justify-between text-[var(--muted)]">
                  <span className="text-[var(--blue)] font-bold">{log.tool}</span>
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-[var(--ink)]">
                  <pre className="text-[11px] overflow-x-auto p-2 bg-[var(--canvas)] rounded border border-[var(--line)]">
                    {JSON.stringify(log.response, null, 2)}
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
