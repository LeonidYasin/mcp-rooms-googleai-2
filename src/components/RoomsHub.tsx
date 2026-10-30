import React, { useState, useEffect, useRef } from 'react';
import { McpRoom, McpMessage, Listing, ListingCategory, CATEGORY_LABELS } from '../types';
import { getStoredApiKey } from '../lib/api';

interface RoomsHubProps {
  rooms: McpRoom[];
  listings: Listing[];
  selectedRoomId?: string;
  onSelectRoom?: (roomId: string) => void;
  onSendMessage: (roomId: string, message: McpMessage) => Promise<void>;
  onOpenListing: (listing: Listing) => void;
  onCreateRoom: (roomData: {
    listingId?: string;
    title: string;
    category?: string;
    visibility: 'public' | 'private';
    initialMessage?: string;
  }) => Promise<void>;
  onRequireKey: (reason: string) => void;
}

export const RoomsHub: React.FC<RoomsHubProps> = ({
  rooms,
  listings,
  selectedRoomId: initialSelectedRoomId,
  onSelectRoom,
  onSendMessage,
  onOpenListing,
  onCreateRoom,
  onRequireKey,
}) => {
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [selectedCategory, setSelectedCategory] = useState<ListingCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialSelectedRoomId || '');
  const [inputText, setInputText] = useState('');
  const [sendRole, setSendRole] = useState<'human' | 'agent'>('human');
  const [isSending, setIsSending] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);

  // New room modal state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<ListingCategory>('business');
  const [newVisibility, setNewVisibility] = useState<'public' | 'private'>('public');
  const [newListingId, setNewListingId] = useState<string>('');
  const [newInitialMessage, setNewInitialMessage] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync selectedRoomId if prop changes
  useEffect(() => {
    if (initialSelectedRoomId) {
      setSelectedRoomId(initialSelectedRoomId);
      const targetRoom = rooms.find((r) => r.id === initialSelectedRoomId);
      if (targetRoom?.visibility) {
        setActiveTab(targetRoom.visibility);
      }
    }
  }, [initialSelectedRoomId, rooms]);

  // Filter rooms based on active tab, category, and search query
  const filteredRooms = rooms.filter((room) => {
    // Visibility tab
    const roomVisibility = room.visibility || 'private';
    if (roomVisibility !== activeTab) return false;

    // Category filter
    if (selectedCategory !== 'all') {
      const roomCat = room.category || listings.find((l) => l.id === room.listingId)?.content?.category;
      if (roomCat !== selectedCategory) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = (room.listingTitle || room.title || '').toLowerCase().includes(q);
      const messagesMatch = room.messages.some((m) => m.text.toLowerCase().includes(q));
      if (!titleMatch && !messagesMatch) return false;
    }

    return true;
  });

  // Default select first room if none selected
  useEffect(() => {
    if (!selectedRoomId && filteredRooms.length > 0) {
      setSelectedRoomId(filteredRooms[0].id);
    }
  }, [filteredRooms, selectedRoomId]);

  const activeRoom = rooms.find((r) => r.id === selectedRoomId);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeRoom?.messages]);

  // Connect to SSE for real-time messages in active room
  useEffect(() => {
    if (!activeRoom) {
      setSseConnected(false);
      return;
    }

    let eventSource: EventSource | null = null;
    let isCancelled = false;

    const setupStream = async () => {
      try {
        const apiKey = getStoredApiKey();
        const headers: Record<string, string> = {};
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        // Get SSE ticket
        const ticketRes = await fetch(`/api/rooms/${activeRoom.id}/ticket`, {
          method: 'POST',
          headers,
        });

        if (isCancelled) return;

        let streamUrl = `/api/rooms/${activeRoom.id}/stream`;
        if (ticketRes.ok) {
          const { ticket } = await ticketRes.json();
          streamUrl += `?ticket=${encodeURIComponent(ticket)}`;
        }

        eventSource = new EventSource(streamUrl);
        eventSource.onopen = () => {
          if (!isCancelled) setSseConnected(true);
        };
        eventSource.onerror = () => {
          if (!isCancelled) setSseConnected(false);
        };
      } catch {
        if (!isCancelled) setSseConnected(false);
      }
    };

    setupStream();

    return () => {
      isCancelled = true;
      if (eventSource) eventSource.close();
    };
  }, [activeRoom?.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeRoom) return;

    if (!getStoredApiKey()) {
      onRequireKey('Для отправки сообщений в комнату необходим API-ключ.');
      return;
    }

    setIsSending(true);
    try {
      await onSendMessage(activeRoom.id, {
        id: 'msg-' + Date.now(),
        roomId: activeRoom.id,
        sender: 'user:me',
        role: sendRole,
        text: inputText.trim(),
        timestamp: Date.now(),
      });
      setInputText('');
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (!getStoredApiKey()) {
      onRequireKey('Создание комнаты требует API-ключ.');
      return;
    }

    try {
      await onCreateRoom({
        listingId: newListingId || undefined,
        title: newTitle.trim(),
        category: newCategory,
        visibility: newVisibility,
        initialMessage: newInitialMessage.trim() || undefined,
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewInitialMessage('');
      setActiveTab(newVisibility);
    } catch (err: any) {
      alert(`Ошибка создания: ${err.message}`);
    }
  };

  const publicCount = rooms.filter((r) => r.visibility === 'public').length;
  const privateCount = rooms.filter((r) => (r.visibility || 'private') === 'private').length;

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">
      {/* Title & Description Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🤝</span>
            <h1 className="text-2xl md:text-3xl font-black text-[var(--ink)] tracking-tight">
              Каталог переговорных комнат и тем
            </h1>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Единое пространство взаимодействия: открытые темы для обсуждения предложений маркетплейса и приватные 1-на-1 переговоры людей с AI-агентами.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!getStoredApiKey()) {
              onRequireKey('Создание комнаты требует API-ключ.');
            } else {
              setShowCreateModal(true);
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-semibold text-sm shadow-xs transition-colors self-start md:self-auto cursor-pointer"
        >
          <span>➕</span>
          <span>Открыть новую тему / комнату</span>
        </button>
      </div>

      {/* Visibility Tabs (Public vs Private) */}
      <div className="flex items-center gap-3 border-b border-[var(--line)] mb-5">
        <button
          type="button"
          onClick={() => {
            setActiveTab('public');
            const first = rooms.find((r) => r.visibility === 'public');
            if (first) setSelectedRoomId(first.id);
          }}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'public'
              ? 'border-[var(--blue)] text-[var(--blue)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <span>🌐 Все открытые темы (Публичные)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-[var(--blue)]">
            {publicCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('private');
            const first = rooms.find((r) => (r.visibility || 'private') === 'private');
            if (first) setSelectedRoomId(first.id);
          }}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'private'
              ? 'border-[var(--blue)] text-[var(--blue)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <span>🔒 Мои приватные переговоры</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[var(--ink)]">
            {privateCount}
          </span>
        </button>
      </div>

      {/* Filter Row: Category Pills and Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[var(--blue)] text-white'
                : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]'
            }`}
          >
            Все темы
          </button>
          {(
            [
              'business',
              'jobs',
              'services',
              'real_estate',
              'things',
              'dating',
              'rides',
              'delivery',
            ] as ListingCategory[]
          ).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[var(--blue)] text-white'
                  : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <input
            type="text"
            placeholder="Поиск по теме или сообщению..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-sm text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--blue)]"
          />
          <span className="absolute left-2.5 top-2.5 text-xs text-[var(--muted)]">🔍</span>
        </div>
      </div>

      {/* Two-Column Grid: Topics Catalog (Left) + Active Conversation (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px] items-start">
        {/* Left Column: Topics List */}
        <div className="lg:col-span-5 space-y-3 max-h-[720px] overflow-y-auto pr-1">
          {filteredRooms.length === 0 ? (
            <div className="p-8 text-center border border-[var(--line)] rounded-2xl bg-[var(--surface)] text-[var(--muted)]">
              <span className="text-3xl block mb-2">📭</span>
              <p className="font-semibold text-[var(--ink)]">
                {activeTab === 'public'
                  ? 'В этой категории пока нет открытых тем'
                  : 'У вас пока нет приватных комнат'}
              </p>
              <p className="text-xs mt-1">
                {activeTab === 'public'
                  ? 'Будьте первым — создайте открытое обсуждение для интересующего объявления или вопроса.'
                  : 'Приватные комнаты создаются при отклике на объявление через кнопку «Написать продавцу».'}
              </p>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isSelected = room.id === selectedRoomId;
              const relatedListing = listings.find((l) => l.id === room.listingId);
              const roomCategory =
                room.category || (relatedListing?.content?.category as ListingCategory) || 'other';
              const lastMsg = room.messages[room.messages.length - 1];

              return (
                <div
                  key={room.id}
                  onClick={() => {
                    setSelectedRoomId(room.id);
                    if (onSelectRoom) onSelectRoom(room.id);
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[var(--blue)] bg-blue-50/50 dark:bg-blue-950/20 shadow-xs'
                      : 'border-[var(--line)] bg-[var(--canvas)] hover:bg-[var(--surface)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--soft)] text-[var(--blue)]">
                        {CATEGORY_LABELS[roomCategory as ListingCategory] || 'Общая тема'}
                      </span>
                      {room.visibility === 'public' ? (
                        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <span>🌐</span>
                          <span>Публичная</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-zinc-700 bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <span>🔒</span>
                          <span>Приватная</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--muted)]">
                      💬 {room.messages.length}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[var(--ink)] line-clamp-2 mb-1.5">
                    {room.listingTitle || room.title || 'Тема переговоров'}
                  </h3>

                  {lastMsg && (
                    <p className="text-xs text-[var(--muted)] line-clamp-2 mb-2">
                      <strong className="text-[var(--ink)]">
                        {lastMsg.sender.replace('user:', '').replace('agent:', '👼 ')}:
                      </strong>{' '}
                      {lastMsg.text}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--muted)] border-t border-[var(--line)] pt-2 mt-2">
                    <span className="truncate">
                      👥 {room.participants.length} участн.
                    </span>
                    {relatedListing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenListing(relatedListing);
                        }}
                        className="text-[var(--blue)] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <span>🔗 Карточка</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Active Conversation */}
        <div className="lg:col-span-7 border border-[var(--line)] rounded-2xl bg-[var(--canvas)] flex flex-col h-[720px] shadow-xs overflow-hidden">
          {activeRoom ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 border-b border-[var(--line)] bg-[var(--surface)] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--soft)] text-[var(--blue)]">
                      {CATEGORY_LABELS[
                        (activeRoom.category ||
                          listings.find((l) => l.id === activeRoom.listingId)?.content?.category ||
                          'other') as ListingCategory
                      ]}
                    </span>
                    {activeRoom.visibility === 'public' ? (
                      <span className="text-xs text-emerald-700 bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded font-medium">
                        🌐 Публичная тема
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-700 bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded font-medium">
                        🔒 Приватная комната (1-на-1)
                      </span>
                    )}
                    <span
                      className={`text-[11px] font-semibold flex items-center gap-1 ${
                        sseConnected ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      <span>●</span>
                      <span>{sseConnected ? 'SSE Live' : 'Офлайн'}</span>
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-[var(--ink)] truncate">
                    {activeRoom.listingTitle || activeRoom.title || 'Переговорная комната'}
                  </h2>
                </div>

                {activeRoom.listingId && (
                  <button
                    type="button"
                    onClick={() => {
                      const l = listings.find((item) => item.id === activeRoom.listingId);
                      if (l) onOpenListing(l);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--line)] bg-[var(--canvas)] hover:bg-[var(--surface)] text-[var(--ink)] shrink-0 cursor-pointer"
                  >
                    Посмотреть объявление ↗
                  </button>
                )}
              </div>

              {/* Participants Bar */}
              <div className="px-4 py-2 border-b border-[var(--line)] bg-[var(--soft)]/30 text-xs text-[var(--muted)] flex items-center justify-between gap-2">
                <span className="truncate">
                  <strong>Участники:</strong>{' '}
                  {activeRoom.participants
                    .map((p) => p.replace('user:', '').replace('agent:', '👼 '))
                    .join(' · ')}
                </span>
                <span className="text-[11px] shrink-0">
                  ID: <code className="text-[10px]">{activeRoom.id}</code>
                </span>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[var(--canvas)]">
                {activeRoom.messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-sm text-[var(--muted)]">
                    <div>
                      <span className="text-3xl block mb-2">💬</span>
                      <p>Сообщений пока нет.</p>
                      <p className="text-xs mt-1">
                        Задайте первый вопрос или поручите агенту вступить в диалог!
                      </p>
                    </div>
                  </div>
                ) : (
                  activeRoom.messages.map((m) => {
                    const isAgent = m.role === 'agent' || m.sender.startsWith('agent:');
                    const isSystem = m.role === 'system';

                    if (isSystem) {
                      return (
                        <div key={m.id} className="text-center my-2">
                          <span className="text-[11px] text-[var(--muted)] px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--line)]">
                            ℹ️ {m.text}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isAgent ? 'items-start' : 'items-end'}`}
                      >
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)] mb-1 px-1">
                          {isAgent ? (
                            <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                              <span>👼</span>
                              <span>{m.sender.replace('agent:', '') || 'MCP Agent'}</span>
                            </span>
                          ) : (
                            <span className="font-semibold text-[var(--ink)]">
                              👤 {m.sender.replace('user:', '')}
                            </span>
                          )}
                          <span>·</span>
                          <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            isAgent
                              ? 'bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-[var(--ink)]'
                              : 'bg-[var(--blue)] text-white shadow-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <form onSubmit={handleSend} className="p-3 border-t border-[var(--line)] bg-[var(--surface)]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-[var(--muted)]">Отправить как:</span>
                    <button
                      type="button"
                      onClick={() => setSendRole('human')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                        sendRole === 'human'
                          ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-xs border border-[var(--line)]'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      👤 Человек
                    </button>
                    <button
                      type="button"
                      onClick={() => setSendRole('agent')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                        sendRole === 'agent'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      🤖 MCP-Агент
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      sendRole === 'agent'
                        ? 'Сообщение от лица автономного агента...'
                        : 'Напишите сообщение...'
                    }
                    className="flex-1 h-10 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--canvas)] text-sm text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--blue)]"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !inputText.trim()}
                    className="h-10 px-5 rounded-xl bg-[var(--blue)] hover:bg-[var(--blue-hover)] disabled:opacity-50 text-white font-semibold text-sm transition-colors cursor-pointer"
                  >
                    {isSending ? '...' : 'Отправить'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="h-full flex items-center justify-center p-8 text-center text-[var(--muted)]">
              <div>
                <span className="text-4xl block mb-3">💬</span>
                <p className="font-bold text-base text-[var(--ink)]">Выберите комнату для диалога</p>
                <p className="text-xs mt-1 max-w-sm">
                  Выберите открытую тему из каталога слева или создайте новое обсуждение.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--canvas)] border border-[var(--line)] rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--ink)]">
                Новая переговорная комната / тема
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)] text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">
                  Название темы / обсуждения
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Обсуждение условий поставки оборудования"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">
                  Категория
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as ListingCategory)}
                  className="w-full h-10 px-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] outline-none"
                >
                  <option value="business">Бизнес и стартапы</option>
                  <option value="jobs">Вакансии</option>
                  <option value="services">Услуги</option>
                  <option value="real_estate">Недвижимость</option>
                  <option value="things">Товары</option>
                  <option value="dating">Знакомства</option>
                  <option value="rides">Поездки</option>
                  <option value="delivery">Доставка</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">
                  Тип видимости
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`p-3 border rounded-xl cursor-pointer flex flex-col gap-1 ${
                      newVisibility === 'public'
                        ? 'border-[var(--blue)] bg-blue-50/40 dark:bg-blue-950/20'
                        : 'border-[var(--line)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink)]">
                      <input
                        type="radio"
                        name="visibility"
                        value="public"
                        checked={newVisibility === 'public'}
                        onChange={() => setNewVisibility('public')}
                      />
                      <span>🌐 Публичная</span>
                    </div>
                    <span className="text-[11px] text-[var(--muted)] leading-tight">
                      Видна всем в общем каталоге тем
                    </span>
                  </label>

                  <label
                    className={`p-3 border rounded-xl cursor-pointer flex flex-col gap-1 ${
                      newVisibility === 'private'
                        ? 'border-[var(--blue)] bg-blue-50/40 dark:bg-blue-950/20'
                        : 'border-[var(--line)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink)]">
                      <input
                        type="radio"
                        name="visibility"
                        value="private"
                        checked={newVisibility === 'private'}
                        onChange={() => setNewVisibility('private')}
                      />
                      <span>🔒 Приватная</span>
                    </div>
                    <span className="text-[11px] text-[var(--muted)] leading-tight">
                      Только для участников 1-на-1
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">
                  Связать с объявлением (по желанию)
                </label>
                <select
                  value={newListingId}
                  onChange={(e) => {
                    setNewListingId(e.target.value);
                    const chosen = listings.find((l) => l.id === e.target.value);
                    if (chosen && !newTitle) {
                      setNewTitle(chosen.content.title);
                      setNewCategory(chosen.content.category);
                    }
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] outline-none"
                >
                  <option value="">Без привязки к объявлению</option>
                  {listings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.content.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">
                  Первое сообщение (по желанию)
                </label>
                <textarea
                  rows={3}
                  value={newInitialMessage}
                  onChange={(e) => setNewInitialMessage(e.target.value)}
                  placeholder="Приветственное сообщение или вопрос..."
                  className="w-full p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] outline-none text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] hover:bg-[var(--surface)] cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-semibold rounded-lg text-sm cursor-pointer"
                >
                  Создать комнату
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
