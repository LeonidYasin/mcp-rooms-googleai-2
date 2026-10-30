import React, { useState, useRef, useEffect } from 'react';
import { Listing, McpRoom, NegotiationResult, EmbeddingProviderStatus } from '../types';
import { getStoredApiKey, createGuestSession } from '../lib/api';
import { AiSettingsModal } from './AiSettingsModal';
import {
  getStoredLlmConfig,
  UserLlmConfig,
  PROVIDER_PRESETS,
} from '../lib/llmProviders';
import {
  getStoredGoogleToken,
  getStoredGoogleUser,
  clearGoogleAuth,
  GoogleUserProfile,
} from '../lib/googleAuth';

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
  degraded?: boolean;
  degradedReason?: string;
  authType?: string;
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
  /** Called when the request needs a key (no key stored, or the server said 401). */
  onRequireKey?: (reason: string) => void;
}

const DEGRADED_REASON_LABELS: Record<string, string> = {
  missing_api_key: 'локальный режим — ответ построен по каталогу (выберите ИИ в настройках)',
  model_not_configured: 'локальный режим — модель не сконфигурирована',
  invalid_api_key: 'ключ ИИ отклонён — проверьте правильность ключа',
  model_error: 'ошибка вызова модели — ответ построен локально',
  google_token_expired: 'срок действия сессии истёк — войдите заново',
};

function degradedTitle(reason?: string): string {
  if (!reason) return 'Модель не вызывалась';
  return DEGRADED_REASON_LABELS[reason] || reason;
}

export const McpChat: React.FC<McpChatProps> = ({
  onOpenListing,
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
        'Привет! Я ваш Агент-Ангел и персональный помощник на площадке «Хочу · Предлагаю» ✨\n\nСо мной можно свободно поговорить на абсолютно любые темы — обсудить идеи, проектные планы, технологии, задать вопрос или просто поболтать. А если нужно решить задачу на площадке, я с радостью помогу:\n\n• 🤝 **Бизнес:** найти партнёра, инвестора или кофаундера;\n• 💼 **Работа:** подобрать вакансию или специалиста в команду;\n• 🏢 **Недвижимость:** найти удобный коворкинг, офис или жильё;\n• 🔧 **Услуги:** найти мастера или исполнителя под ключ;\n• 🌲 **Сообщества и хобби:** найти компанию для спорта или совместных проектов.\n\nВы можете выбрать любую нейросеть для общения (OpenRouter, DeepSeek, Gemini, OpenAI) через кнопку настроек вверху. Чем могу помочь вам сегодня? 😊',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedDialogueId, setExpandedDialogueId] = useState<string | null>(null);
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingProviderStatus | null>(null);
  const [serverLlmInfo, setServerLlmInfo] = useState<{ configured: boolean; serverProvider: string | null; model: string | null } | null>(null);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<'ai' | 'mcp' | 'profile'>('ai');

  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(getStoredGoogleUser());
  const [hasGoogleAuth, setHasGoogleAuth] = useState<boolean>(Boolean(getStoredGoogleToken()));
  const [llmConfig, setLlmConfig] = useState<UserLlmConfig | null>(getStoredLlmConfig());
  const [hasStoredApiKey, setHasStoredApiKey] = useState<boolean>(Boolean(getStoredApiKey()));

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const refreshAuthAndStatus = () => {
    setHasStoredApiKey(Boolean(getStoredApiKey()));
    setHasGoogleAuth(Boolean(getStoredGoogleToken()));
    setGoogleUser(getStoredGoogleUser());
    setLlmConfig(getStoredLlmConfig());

    // Check server LLM status
    fetch('/api/llm/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setServerLlmInfo({
            configured: Boolean(data.configured),
            serverProvider: data.serverProvider || null,
            model: data.model || null,
          });
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshAuthAndStatus();
    // Fetch live embedding provider status from backend
    fetch('/api/embedding/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setEmbeddingStatus(data);
      })
      .catch(() => {});
  }, [isAiModalOpen]);

  const isAiActive = Boolean(llmConfig?.apiKey || serverLlmInfo?.configured);

  const handleQuickGuestLogin = async () => {
    try {
      setIsLoading(true);
      await createGuestSession();
      setHasStoredApiKey(true);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Ошибка создания гостевой сессии');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    // Chat requires an identity (key, google login, or guest)
    const storedApiKey = getStoredApiKey();
    const googleToken = getStoredGoogleToken();
    const currentLlm = getStoredLlmConfig();
    const hasAuth = Boolean(storedApiKey || googleToken || currentLlm?.apiKey);

    if (!hasAuth) {
      setModalInitialTab('ai');
      setIsAiModalOpen(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    const currentUser = getStoredGoogleUser();
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (storedApiKey) {
        headers['Authorization'] = `Bearer ${storedApiKey}`;
      } else if (googleToken) {
        headers['Authorization'] = `Bearer ${googleToken}`;
      } else if (currentLlm?.apiKey) {
        headers['Authorization'] = `Bearer ${currentLlm.apiKey}`;
      }

      if (googleToken) {
        headers['x-google-access-token'] = googleToken;
        if (currentUser?.email) {
          headers['x-google-user-id'] = currentUser.email;
        }
      }

      if (currentLlm?.apiKey) {
        headers['x-llm-provider'] = currentLlm.provider;
        headers['x-llm-api-key'] = currentLlm.apiKey;
        headers['x-llm-model'] = currentLlm.model;
        if (currentLlm.baseUrl) {
          headers['x-llm-base-url'] = currentLlm.baseUrl;
        }
        if (currentLlm.provider === 'gemini') {
          headers['x-gemini-api-key'] = currentLlm.apiKey;
        }
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetListingId: contextListing?.id || undefined,
          googleAccessToken: googleToken || undefined,
          llmProvider: currentLlm?.provider,
          llmApiKey: currentLlm?.apiKey,
          llmModel: currentLlm?.model,
          llmBaseUrl: currentLlm?.baseUrl,
          googleUserId: currentUser?.email || undefined,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        if (googleToken && !storedApiKey) {
          clearGoogleAuth();
          setHasGoogleAuth(false);
          setGoogleUser(null);
        }
        setIsAiModalOpen(true);
        return;
      }
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Ошибка обработки запроса');
      }

      const assistantMessage: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        role: 'assistant',
        content: data.text || 'Сообщение принято и обработано.',
        timestamp: Date.now(),
        negotiation: data.negotiation,
        executedTools: data.executedTools || [],
        createdListing: data.createdListing,
        degraded: data.degraded === true,
        degradedReason: data.degradedReason,
        authType: data.authType,
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
          content: `⚠️ Ошибка: ${err.message || 'Сбой подключения'}. Пожалуйста, попробуйте ещё раз.`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const promptPresets = [
    {
      label: '💬 Расскажи, чем ты можешь помочь?',
      text: 'Привет! Расскажи подробно, как устроена площадка «Хочу · Предлагаю» и чем ты можешь мне помочь?',
    },
    {
      label: '🏢 Найти коворкинг или офис в Казани',
      text: 'Найди современный коворкинг или офис в центре Казани и покажи варианты',
    },
    {
      label: '🤝 Найти партнёра в IT-стартап',
      text: 'Найди партнёра или кофаундера для технологического проекта и помоги составить предложение',
    },
    {
      label: '💼 Найти интересные вакансии и людей',
      text: 'Найди специалистов по разработке или актуальные вакансии на площадке',
    },
    {
      label: '🔧 Найти мастера для ремонта под ключ',
      text: 'Найди проверенного исполнителя для ремонта или бытовых услуг в Казани',
    },
    {
      label: '🌲 Найти компанию для отдыха и спорта',
      text: 'Найди единомышленников для совместных выездов, походов или настольных игр',
    },
    {
      label: '💡 Посоветуй идеи для полезного проекта',
      text: 'Посоветуй интересные идеи для полезного сервиса или локального сообщества',
    },
  ];

  return (
    <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-6 flex flex-col h-[calc(100vh-175px)] min-h-[650px]">
      {/* Top Header Card */}
      <div className="border border-[var(--line)] rounded-t-2xl p-4 bg-[var(--surface)] flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center text-2xl shadow-sm">
            👼
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base md:text-lg font-black text-[var(--ink)] tracking-tight">
                Агент-Ангел · Ваш ИИ-помощник
              </h1>
              <span className="text-[11px] bg-[var(--greenbg)] text-[var(--green)] font-bold px-2.5 py-0.5 rounded-full">
                SQLite БД + MCP
              </span>
              {llmConfig?.apiKey ? (
                <span className="text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>✨ {PROVIDER_PRESETS[llmConfig.provider]?.name || llmConfig.provider}: {llmConfig.model}</span>
                </span>
              ) : serverLlmInfo?.configured ? (
                <span className="text-[11px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border border-indigo-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  <span>✨ Серверный ИИ: {serverLlmInfo.model || serverLlmInfo.serverProvider}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setModalInitialTab('ai');
                    setIsAiModalOpen(true);
                  }}
                  className="text-[11px] bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border border-amber-500/20 hover:opacity-90 cursor-pointer"
                  title="Нажмите, чтобы выбрать нейросеть"
                >
                  <span>💡 Базовый режим</span>
                  <span className="underline">выбрать ИИ (OpenRouter, DeepSeek, Gemini) ↗</span>
                </button>
              )}
            </div>
            <p className="text-xs text-[var(--muted)]">
              Свободный диалог на любые темы, поиск людей, жилья, услуг и идей на площадке «Хочу · Предлагаю»
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Button: External AI MCP Guide */}
          <button
            type="button"
            onClick={() => {
              setModalInitialTab('mcp');
              setIsAiModalOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 px-3 py-1.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer font-semibold shadow-xs"
            title="Инструкция по подключению Claude Desktop, Cursor или ChatGPT к MCP"
          >
            <span>🔌</span>
            <span className="hidden sm:inline">Внешний Claude / ChatGPT (MCP)</span>
            <span className="sm:hidden">MCP</span>
          </button>

          {/* Button: AI Settings / Provider */}
          <button
            type="button"
            onClick={() => {
              setModalInitialTab('ai');
              setIsAiModalOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-white border border-blue-400/40 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-colors cursor-pointer shadow-sm"
            title="Выбрать модель и указать API-ключ"
          >
            <span>✨</span>
            <span>{llmConfig?.apiKey ? 'Настройки ИИ' : 'Выбрать ИИ'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setMessages([
                {
                  id: 'reset-' + Date.now(),
                  role: 'assistant',
                  content:
                    'Привет снова! История диалога обновлена. Я готов пообщаться на любую тему или помочь найти что-то полезное на площадке 😊',
                  timestamp: Date.now(),
                },
              ])
            }
            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] px-3 py-1.5 rounded-xl bg-[var(--canvas)] hover:bg-[var(--raised)] transition-colors cursor-pointer"
          >
            Очистить
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
                    `Покажи демонстрационный сценарий переговоров по объявлению «${contextListing.content.title}». Ничего не отправляй автору и не создавай комнату.`
                  )
                }
                className="text-xs font-bold px-3 py-1.5 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white rounded-lg transition-colors cursor-pointer"
              >
                ⚡ Демо-сценарий
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
                {m.role === 'user' ? 'Вы' : 'Агент-Ангел 👼'}
              </span>
              <span>·</span>
              <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              {m.authType && !m.degraded && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold text-[10px]"
                  title={`Ответ сгенерирован через ${m.authType}`}
                >
                  ✨ {m.authType}
                </span>
              )}
              {m.degraded && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-semibold text-[10px]"
                  title={degradedTitle(m.degradedReason)}
                >
                  базовый режим
                </span>
              )}
            </div>

            <div
              className={`max-w-[90%] md:max-w-[82%] rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap shadow-xs ${
                m.role === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-br-xs'
                  : 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] rounded-bl-xs'
              }`}
            >
              {m.content}

              {/* AUTONOMOUS NEGOTIATION TRACKER CARD */}
              {m.negotiation && (
                <div className="mt-4 pt-4 border-t border-[var(--line)] space-y-3.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-black tracking-wider uppercase text-[var(--blue)] flex items-center gap-1.5">
                      <span>⚡ Демонстрационный сценарий переговоров:</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          m.negotiation.status === 'demo_preview'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                            : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {m.negotiation.status === 'demo_preview'
                          ? 'Демо · автору ничего не отправлено'
                          : m.negotiation.status === 'no_match'
                          ? 'Совпадений нет'
                          : m.negotiation.status === 'in_progress'
                          ? 'В процессе...'
                          : 'Демо'}
                      </span>
                    </div>
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
                        {st.status === 'in_progress' ? (
                          <span className="w-2 h-2 mt-1 rounded-full bg-[var(--blue)] animate-ping shrink-0" />
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">✓</span>
                        )}
                        <div className="min-w-0">
                          <strong className="text-[var(--ink)] block">{st.title}</strong>
                          <span className="text-[var(--muted)] text-[11px]">{st.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Direct Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {m.negotiation.targetListing && (
                      <button
                        type="button"
                        onClick={() => onOpenListing(m.negotiation!.targetListing!)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>Открыть карточку и написать автору →</span>
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
            <div className="text-[11px] text-[var(--muted)] px-1 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--blue)] animate-ping" />
              <span>Агент-Ангел думает и готовит ответ...</span>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-3.5 text-xs text-[var(--muted)] space-y-1.5 max-w-md shadow-xs">
              <p className="text-[var(--ink)] font-medium">
                Анализирую ваш вопрос и подбираю наилучший ответ ✨
              </p>
              <p className="text-[11px] leading-relaxed">
                Ищу информацию в базе данных SQLite и формулирую рекомендации.
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Guidance Banner if neither key nor Google is connected */}
      {!hasStoredApiKey && !hasGoogleAuth && !llmConfig?.apiKey && (
        <div className="border-x border-t border-[var(--line)] bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink)]">
          <div className="flex items-center gap-2 font-medium">
            <span>👋</span>
            <span>Для свободного общения выберите любую нейросеть или войдите как гость:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setModalInitialTab('ai');
                setIsAiModalOpen(true);
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg font-bold cursor-pointer shadow-xs transition-colors"
            >
              ✨ Выбрать ИИ (OpenRouter, DeepSeek, Gemini)
            </button>
            <span className="text-[var(--muted)] text-[11px]">или</span>
            <button
              type="button"
              disabled={isLoading}
              onClick={handleQuickGuestLogin}
              className="px-3 py-1.5 bg-[var(--surface)] hover:bg-[var(--raised)] border border-[var(--line)] text-[var(--ink)] rounded-lg font-semibold cursor-pointer transition-colors shadow-xs disabled:opacity-50"
            >
              👤 Войти как Гость (1 клик)
            </button>
          </div>
        </div>
      )}

      {/* Preset Chips */}
      <div className="border-x border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[var(--muted)] font-semibold shrink-0">💭 Темы для начала:</span>
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
          placeholder="Напишите сообщение или спросите о чём угодно..."
          className="flex-1 h-11 px-4 border border-[var(--line)] rounded-xl bg-[var(--canvas)] text-[var(--ink)] text-sm outline-none focus:border-[var(--blue)] transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="h-11 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-xs"
        >
          <span>Отправить</span>
          <svg className="w-4 h-4 -rotate-45 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>

      <AiSettingsModal
        isOpen={isAiModalOpen}
        initialTab={modalInitialTab}
        onClose={() => setIsAiModalOpen(false)}
        onConfigSaved={(_config) => {
          refreshAuthAndStatus();
        }}
        onGuestLogin={async () => {
          setIsAiModalOpen(false);
          await handleQuickGuestLogin();
        }}
      />
    </div>
  );
};
