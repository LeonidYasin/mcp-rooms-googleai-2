import React, { useState, useRef, useEffect } from 'react';
import { Listing, McpRoom, NegotiationResult, EmbeddingProviderStatus } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  negotiation?: NegotiationResult;
  executedTools?: Array<{
    name: string;
    args: any;
    result: any;
  }>;
  createdListing?: any;
}

interface McpChatProps {
  listings: Listing[];
  rooms: McpRoom[];
  onOpenListing: (listing: Listing) => void;
  onOpenRoom?: (roomId: string) => void;
  onListingCreated: (listing: Listing) => void;
  onRefreshData?: () => void;
  contextListing?: Listing | null;
  onClearContextListing?: () => void;
}

export const McpChat: React.FC<McpChatProps> = ({
  listings,
  rooms,
  onOpenListing,
  onOpenRoom,
  onListingCreated,
  onRefreshData,
  contextListing,
  onClearContextListing,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-angel',
      role: 'assistant',
      content:
        'Здравствуйте! Я ваш персональный **Агент-Ангел** площадки MCP Rooms.\n\nЯ умею автономно решать ваши задачи через реальные MCP-инструменты и базу данных SQLite:\n\n• **Бизнес:** найду бизнес-партнёра, кофаундера или инвестора;\n• **Услуги:** найду проверенного мастера и согласую выезд и смету;\n• **Работа:** подберу вакансию или специалистов по стеку;\n• **Знакомства:** найду компанию для хобби, спорта и поездок;\n• **Товары:** договорюсь о покупке, проверке и самовывозе.\n\nДайте мне задачу — я найду совпадения через асимметричный семантический матчинг, войду в комнату переговоров и проведу раунд согласования с агентом автора!',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTabPrompt, setActiveTabPrompt] = useState<'all' | 'biz' | 'services' | 'jobs' | 'dating'>('all');
  const [expandedDialogueId, setExpandedDialogueId] = useState<string | null>(null);
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingProviderStatus | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    // Fetch live embedding provider status from backend
    fetch('/api/embedding/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setEmbeddingStatus(data);
      })
      .catch(() => {});
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetListingId: contextListing?.id || undefined,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка обработки запроса');
      }

      const assistantMessage: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        role: 'assistant',
        content: data.text || 'Поручение принято и обработано.',
        timestamp: Date.now(),
        negotiation: data.negotiation,
        executedTools: data.executedTools || [],
        createdListing: data.createdListing,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.createdListing) {
        onListingCreated(data.createdListing);
      }
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'msg-' + (Date.now() + 1),
          role: 'assistant',
          content: `⚠️ Ошибка: ${err.message || 'Сбой подключения'}. Пожалуйста, повторите запрос.`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const promptPresets = [
    {
      category: 'biz',
      label: '🤝 Найти партнёра в IT-стартап (B2B AI в Казани)',
      text: 'Найди партнёра или кофаундера для B2B AI-стартапа в Казани, согласуй предварительный звонок',
    },
    {
      category: 'services',
      label: '🔧 Найти мастера на ремонт санузла (до 40 000 ₽)',
      text: 'Найди исполнителя на комплексный ремонт санузла в Казани, уточни гарантию и согласуй замер на субботу',
    },
    {
      category: 'jobs',
      label: '💼 Найти вакансию Senior TypeScript / Backend',
      text: 'Найди вакансию Senior TypeScript разработчика с зарплатой от 300 000 руб и удалённым форматом',
    },
    {
      category: 'dating',
      label: '🌲 Найти компанию для походов и веловыездов',
      text: 'Найди компанию или единомышленников для походов в горы и веловыездов на выходных',
    },
    {
      category: 'all',
      label: '🚴 Найти городской велосипед с планетарной втулкой',
      text: 'Найди городской велосипед в Казани и согласуй возможность самовывоза возле парка Горького',
    },
  ];

  return (
    <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-6 flex flex-col h-[calc(100vh-175px)] min-h-[650px]">
      {/* Top Header Card */}
      <div className="border border-[var(--line)] rounded-t-2xl p-4 bg-[var(--surface)] flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-sm">
            👼
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base md:text-lg font-black text-[var(--ink)] tracking-tight">
                Агент-Ангел · Персональный ИИ-ассистент
              </h1>
              <span className="text-[11px] bg-[var(--greenbg)] text-[var(--green)] font-bold px-2.5 py-0.5 rounded-full">
                SQLite БД + MCP
              </span>
              {embeddingStatus?.isAvailable ? (
                <span className="text-[11px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded-md" title={embeddingStatus.reason}>
                  ✨ Google Embeddings API
                </span>
              ) : (
                <span className="text-[11px] bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-semibold px-2 py-0.5 rounded-md" title={embeddingStatus?.reason || 'Fallback'}>
                  ⚡ Лексический Fallback
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted)]">
              Автономный асимметричный поиск «Хочу» ↔ «Предлагаю», вход в Shared Rooms и согласование условий
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setMessages([
                {
                  id: 'reset-' + Date.now(),
                  role: 'assistant',
                  content:
                    'Диалог обновлён. Я готов принять новое поручение по поиску партнёров, специалистов, товаров или знакомств!',
                  timestamp: Date.now(),
                },
              ])
            }
            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] px-3 py-1.5 rounded-lg bg-[var(--canvas)] hover:bg-[var(--raised)] transition-colors cursor-pointer"
          >
            Очистить историю
          </button>
        </div>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 border-x border-[var(--line)] bg-[var(--canvas)] p-4 md:p-6 overflow-y-auto space-y-5">
        {/* Context Anchor Card when assigned from a specific listing */}
        {contextListing && (
          <div className="bg-[var(--soft)] border border-blue-200 dark:border-blue-900 rounded-xl p-3.5 mb-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-white bg-[var(--blue)] px-2 py-0.5 rounded">
                    {contextListing.content.kind === 'offer' ? 'Предлагаю' : 'Хочу'}
                  </span>
                  <strong className="text-xs md:text-sm text-[var(--ink)]">{contextListing.content.title}</strong>
                </div>
                <div className="text-[11px] text-[var(--muted)] mt-0.5">
                  Автор: <span className="font-semibold text-[var(--ink)]">{contextListing.author_name}</span> · {contextListing.content.locality}
                  {contextListing.content.price_minor ? ` · ${(contextListing.content.price_minor / 100).toLocaleString('ru-RU')} ₽` : ' · Договорная'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleSendMessage(
                    `Проведи автономные переговоры с агентом автора по объявлению «${contextListing.content.title}». Наша задача: согласовать условия, график и подтвердить сделку в безопасной комнате MCP.`
                  )
                }
                className="text-xs font-bold px-3 py-1.5 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white rounded-lg transition-colors cursor-pointer"
              >
                ⚡ Провести переговоры
              </button>
              {onClearContextListing && (
                <button
                  type="button"
                  onClick={onClearContextListing}
                  className="text-xs text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] px-2.5 py-1.5 rounded-lg bg-[var(--canvas)] cursor-pointer"
                  title="Снять контекст объявления"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[11px] text-[var(--muted)] px-1">
              <span className="font-semibold">
                {m.role === 'user' ? 'Вы (Владелец)' : 'Ваш Агент-Ангел 👼'}
              </span>
              <span>·</span>
              <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div
              className={`max-w-[90%] md:max-w-[82%] rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap shadow-xs ${
                m.role === 'user'
                  ? 'bg-[var(--blue)] text-white font-medium rounded-br-xs'
                  : 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] rounded-bl-xs'
              }`}
            >
              {m.content}

              {/* AUTONOMOUS NEGOTIATION TRACKER CARD */}
              {m.negotiation && (
                <div className="mt-4 pt-4 border-t border-[var(--line)] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-wider uppercase text-[var(--blue)] flex items-center gap-1.5">
                      <span>⚡ Ход автономных переговоров через MCP:</span>
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        m.negotiation.status === 'agreed'
                          ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
                          : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {m.negotiation.status === 'agreed' ? '✓ Договорённость достигнута' : 'Карточка создана'}
                    </span>
                  </div>

                  {/* Semantic Match Reason and Score */}
                  {m.negotiation.similarityScore !== undefined && (
                    <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-2">
                      <span>🎯 {m.negotiation.matchReason || 'Асимметричный семантический матчинг'}</span>
                      <span className="font-bold text-xs bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded">
                        {Math.round(m.negotiation.similarityScore * 100)}% совпадение
                      </span>
                    </div>
                  )}

                  {/* Steps Progress Timeline */}
                  <div className="space-y-2 bg-[var(--canvas)] p-3 rounded-xl border border-[var(--line)] text-xs">
                    {m.negotiation.steps.map((st, sIdx) => (
                      <div key={sIdx} className="flex items-start gap-2.5">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">✓</span>
                        <div className="min-w-0">
                          <strong className="text-[var(--ink)] block">{st.title}</strong>
                          <span className="text-[var(--muted)] text-[11px]">{st.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Dialogue Accordion between Angel and Counterpart Agent */}
                  {m.negotiation.dialogue && m.negotiation.dialogue.length > 0 && (
                    <div className="bg-[var(--canvas)] border border-[var(--line)] rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDialogueId(expandedDialogueId === m.id ? null : m.id)
                        }
                        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-[var(--ink)] bg-[var(--surface)] hover:bg-[var(--raised)] transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span>💬 Стенограмма переговоров агентов ({m.negotiation.dialogue.length} реплик)</span>
                        </span>
                        <span className="text-[var(--blue)]">
                          {expandedDialogueId === m.id ? 'Свернуть ▲' : 'Развернуть диалог ▼'}
                        </span>
                      </button>

                      {expandedDialogueId === m.id && (
                        <div className="p-3.5 space-y-3 border-t border-[var(--line)] text-xs bg-[var(--canvas)] max-h-72 overflow-y-auto">
                          {m.negotiation.dialogue.map((turn, tIdx) => (
                            <div
                              key={tIdx}
                              className={`p-3 rounded-xl border ${
                                turn.sender === 'agent:angel'
                                  ? 'bg-[var(--soft)] border-blue-200/60 dark:border-blue-900/50 mr-4'
                                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/40 ml-4'
                              }`}
                            >
                              <div className="flex justify-between items-center text-[11px] font-semibold text-[var(--muted)] mb-1">
                                <span>{turn.agentName}</span>
                                <span>{new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-[var(--ink)] leading-relaxed">{turn.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Agreed Terms Box */}
                  {m.negotiation.agreedTerms && (
                    <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-1.5 text-xs">
                      <strong className="text-emerald-800 dark:text-emerald-300 font-bold block">
                        🤝 Согласованные условия:
                      </strong>
                      <div className="text-[var(--ink)] space-y-1">
                        <div>• <strong>Тема:</strong> {m.negotiation.agreedTerms.topic}</div>
                        {m.negotiation.agreedTerms.price && (
                          <div>• <strong>Цена/Условия:</strong> {m.negotiation.agreedTerms.price}</div>
                        )}
                        {m.negotiation.agreedTerms.schedule && (
                          <div>• <strong>Слот:</strong> {m.negotiation.agreedTerms.schedule}</div>
                        )}
                        <div>• <strong>Приватность:</strong> {m.negotiation.agreedTerms.locationProtocol}</div>
                      </div>
                    </div>
                  )}

                  {/* Direct Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {m.negotiation.targetListing && (
                      <button
                        type="button"
                        onClick={() => onOpenListing(m.negotiation!.targetListing)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>Карточка объявления →</span>
                      </button>
                    )}
                    {m.negotiation.roomId && onOpenRoom && (
                      <button
                        type="button"
                        onClick={() => onOpenRoom(m.negotiation!.roomId)}
                        className="px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--canvas)] hover:bg-[var(--raised)] text-[var(--ink)] font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <span>Комната переговоров #{m.negotiation.roomId.substring(0, 16)}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex flex-col items-start space-y-2">
            <div className="text-[11px] text-[var(--muted)] px-1 font-semibold">
              Агент-Ангел выполняет поручение...
            </div>
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-4 text-xs text-[var(--ink)] space-y-2 max-w-md shadow-xs">
              <div className="flex items-center gap-2 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--blue)] animate-ping" />
                <span>Автономная работа через протокол MCP...</span>
              </div>
              <p className="text-[var(--muted)] text-[11px] leading-relaxed">
                1. Запрос в базу данных SQLite ➔ 2. Вход в Shared Room ➔ 3. Согласование условий с агентом контрагента.
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset Chips */}
      <div className="border-x border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[var(--muted)] font-semibold shrink-0">Поручения:</span>
          {promptPresets.map((preset, pIdx) => (
            <button
              key={pIdx}
              type="button"
              disabled={isLoading}
              onClick={() => handleSendMessage(preset.text)}
              className="px-3 py-1 rounded-full bg-[var(--canvas)] hover:bg-[var(--raised)] border border-[var(--line)] text-[var(--ink)] text-xs whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 font-medium"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="border border-[var(--line)] rounded-b-2xl p-3 bg-[var(--surface)] flex gap-2 shadow-sm"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder="Дайте поручение Агенту-Ангелу (бизнес, ремонт, вакансии, знакомства, вещи)..."
          className="flex-1 h-11 px-4 border border-[var(--line)] rounded-xl bg-[var(--canvas)] text-[var(--ink)] text-sm outline-none focus:border-[var(--blue)] transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="h-11 px-6 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-bold text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
        >
          <span>Поручить</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>
    </div>
  );
};
