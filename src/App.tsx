import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Listing,
  ListingCategory,
  McpRoom,
  McpMessage,
  CATEGORY_LABELS,
} from './types';
import { INITIAL_LISTINGS } from './data/mockListings';
import { Header } from './components/Header';
import { ListingCard } from './components/ListingCard';
import { ListingDetail } from './components/ListingDetail';
import { PublishModal } from './components/PublishModal';
import { ContactModal } from './components/ContactModal';
import { AgentModal } from './components/AgentModal';
import { McpConsole } from './components/McpConsole';
import { PrinciplesBanner } from './components/PrinciplesBanner';
import { McpChat } from './components/McpChat';
import { ApiKeyModal } from './components/ApiKeyModal';
import { RoomsHub } from './components/RoomsHub';
import {
  authHeaders,
  getStoredApiKey,
  isUnauthorized,
  readApiFailure,
} from './lib/api';

export const App: React.FC = () => {
  const [listings, setListings] = useState<Listing[]>(INITIAL_LISTINGS);
  // Rooms are private: they only come from the server for the current key.
  const [rooms, setRooms] = useState<McpRoom[]>([]);
  const [apiKey, setApiKey] = useState<string>(getStoredApiKey());
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyReason, setApiKeyReason] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const openApiKeyModal = useCallback((reason?: string) => {
    setApiKeyReason(reason || null);
    setIsApiKeyModalOpen(true);
  }, []);

  // Navigation and filters
  const [currentTab, setCurrentTab] = useState<'catalog' | 'rooms' | 'mcp' | 'principles' | 'chat'>('catalog');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [currentCategory, setCurrentCategory] = useState<ListingCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocality, setSelectedLocality] = useState<string>('all');
  const [filterKind, setFilterKind] = useState<'all' | 'offer' | 'request'>('all');

  // Modals
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [contactModalListing, setContactModalListing] = useState<Listing | null>(null);
  const [agentModalListing, setAgentModalListing] = useState<Listing | null>(null);
  const [contextListing, setContextListing] = useState<Listing | null>(null);

  const handleOpenRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
    setSelectedListing(null);
    setCurrentTab('rooms');
  }, []);

  // Fetch real listings and rooms from SQLite server database
  const refreshDataFromDb = useCallback(async () => {
    try {
      const hasKey = Boolean(getStoredApiKey());
      const [listingsRes, roomsRes] = await Promise.all([
        fetch('/api/listings'),
        hasKey
          ? fetch('/api/rooms?include_public=true', { headers: authHeaders() })
          : fetch('/api/public/rooms'),
      ]);
      if (listingsRes.ok) {
        const data = await listingsRes.json();
        if (Array.isArray(data)) {
          setListings(data);
        }
      }
      if (roomsRes) {
        if (roomsRes.ok) {
          const rData = await roomsRes.json();
          if (Array.isArray(rData)) setRooms(rData);
        } else if (roomsRes.status === 401 || roomsRes.status === 403) {
          // A stale key must not leave someone else's rooms on screen, fall back to public rooms.
          const pubRes = await fetch('/api/public/rooms');
          if (pubRes.ok) {
            const pubData = await pubRes.json();
            if (Array.isArray(pubData)) setRooms(pubData);
          } else {
            setRooms([]);
          }
        }
      } else {
        setRooms([]);
      }
    } catch {
      setActionError('Сервер недоступен: данные не загружены, показаны локальные примеры.');
    }
  }, []);

  useEffect(() => {
    refreshDataFromDb();
  }, [refreshDataFromDb]);

  // Filtered listings
  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      // Category filter
      if (currentCategory !== 'all' && item.content.category !== currentCategory) {
        return false;
      }
      // Kind filter (offer vs request)
      if (filterKind !== 'all' && item.content.kind !== filterKind) {
        return false;
      }
      // Locality filter
      if (
        selectedLocality !== 'all' &&
        item.content.locality &&
        !item.content.locality.toLowerCase().includes(selectedLocality.toLowerCase())
      ) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = item.content.title.toLowerCase().includes(q);
        const inDesc = item.content.description.toLowerCase().includes(q);
        const inCat = CATEGORY_LABELS[item.content.category]?.toLowerCase().includes(q);
        const inSubcat = item.content.subcategory?.toLowerCase().includes(q);
        const inLoc = item.content.locality?.toLowerCase().includes(q);
        return Boolean(inTitle || inDesc || inCat || inSubcat || inLoc);
      }
      return true;
    });
  }, [listings, currentCategory, filterKind, selectedLocality, searchQuery]);

  const handleOpenListing = (listing: Listing) => {
    setSelectedListing(listing);
    setCurrentTab('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePublishListing = async (newListing: Listing) => {
    if (!getStoredApiKey()) {
      setIsPublishModalOpen(false);
      openApiKeyModal('Публикация требует API-ключ: объявление записывается от имени владельца ключа.');
      return;
    }
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(newListing),
      });
      if (res.ok) {
        const created = await res.json();
        setListings((prev) => [created, ...prev.filter((l) => l.id !== created.id)]);
        setSelectedListing(created);
        setIsPublishModalOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const failure = await readApiFailure(res);
      setIsPublishModalOpen(false);
      if (isUnauthorized(failure)) {
        openApiKeyModal('Сервер отклонил ключ. Вставьте действующий ключ (401).');
      } else {
        setActionError(`Не удалось опубликовать: ${failure.message}`);
      }
    } catch {
      setActionError('Сервер недоступен: объявление не сохранено и в каталог не добавлено.');
    }
  };

  const handleAddPhotoToListing = (listingId: string, photoDataUrl: string) => {
    setListings((prev) =>
      prev.map((item) => {
        if (item.id === listingId) {
          const newPhoto = {
            id: 'photo-' + Date.now(),
            dataUrl: photoDataUrl,
          };
          const updated = {
            ...item,
            photos: [...item.photos, newPhoto],
            updated_at: Date.now(),
          };
          if (selectedListing && selectedListing.id === listingId) {
            setSelectedListing(updated);
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleSendMessageToRoom = async (roomId: string, message: McpMessage) => {
    if (!getStoredApiKey()) {
      openApiKeyModal('Чтобы писать в комнату, нужен API-ключ участника.');
      return;
    }
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          role: message.role,
          text: message.text,
        }),
      });
      if (!res.ok) {
        const failure = await readApiFailure(res);
        if (isUnauthorized(failure)) {
          openApiKeyModal('Сервер отклонил ключ. Вставьте действующий ключ (401).');
        } else {
          setActionError(`Сообщение не отправлено: ${failure.message}`);
        }
        return;
      }
      const saved = await res.json();
      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== roomId) return room;
          return {
            ...room,
            messages: [...room.messages, { ...message, id: saved.id || message.id, sender: saved.sender || message.sender }],
          };
        })
      );
    } catch {
      setActionError('Сообщение не отправлено: сервер недоступен.');
    }
  };

  const handleContactSeller = (listing: Listing) => {
    setContactModalListing(listing);
  };

  const handleDelegateToAngel = (listing: Listing) => {
    setContextListing(listing);
    setSelectedListing(null);
    setCurrentTab('chat');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAgentDiscuss = (listing: Listing) => {
    handleDelegateToAngel(listing);
  };

  const handleSendSellerMessage = async (
    listingId: string,
    messageText: string,
    contactInfo: string,
    visibility: 'public' | 'private' = 'private'
  ) => {
    if (!getStoredApiKey()) {
      openApiKeyModal(
        'Отклик на объявление требует API-ключ: сервер записывает сообщение от имени владельца ключа.'
      );
      return;
    }

    const existingRoom = rooms.find(
      (r) => r.listingId === listingId && (r.visibility || 'private') === visibility
    );
    const text = contactInfo
      ? `${messageText}\n\nКонтакт для ответа: ${contactInfo}`
      : messageText;

    if (existingRoom) {
      await handleSendMessageToRoom(existingRoom.id, {
        id: 'msg-' + Date.now(),
        roomId: existingRoom.id,
        sender: 'user:me',
        role: 'human',
        text,
        timestamp: Date.now(),
      });
    } else {
      // The room is created by the real MCP tool, not by a client-side guess.
      try {
        const res = await fetch('/mcp', {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
              name: 'join_room',
              arguments: { listing_id: listingId, initial_message: text, visibility },
            },
          }),
        });
        if (!res.ok) {
          const failure = await readApiFailure(res);
          if (isUnauthorized(failure)) {
            openApiKeyModal('Сервер отклонил ключ. Вставьте действующий ключ (401).');
          } else {
            setActionError(`Не удалось открыть комнату: ${failure.message}`);
          }
          return;
        }
        const body = await res.json();
        const payload = body?.result?.data;
        if (!payload || payload.error) {
          setActionError(
            `Не удалось открыть комнату: ${payload?.message || payload?.error || 'неизвестная ошибка'}`
          );
          return;
        }
        await refreshDataFromDb();
      } catch {
        setActionError('Не удалось открыть комнату: сервер недоступен.');
        return;
      }
    }

    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, responses_count: l.responses_count + 1 } : l))
    );
    if (selectedListing && selectedListing.id === listingId) {
      setSelectedListing((prev) =>
        prev ? { ...prev, responses_count: prev.responses_count + 1 } : prev
      );
    }
  };

  const handleCreateRoom = async (roomData: {
    listingId?: string;
    title: string;
    category?: string;
    visibility: 'public' | 'private';
    initialMessage?: string;
  }) => {
    if (!getStoredApiKey()) {
      openApiKeyModal('Создание комнаты требует API-ключ.');
      return;
    }
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(roomData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Не удалось создать комнату');
    }
    const created = await res.json();
    setRooms((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
    setSelectedRoomId(created.id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--canvas)] text-[var(--ink)]">
      {/* Header */}
      <Header
        currentCategory={currentCategory}
        onSelectCategory={(cat) => {
          setCurrentCategory(cat);
          setSelectedListing(null);
          setCurrentTab('catalog');
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => {
          setSelectedListing(null);
          setCurrentTab('catalog');
        }}
        onOpenPublish={() => setIsPublishModalOpen(true)}
        onGoHome={() => {
          setSelectedListing(null);
          setCurrentCategory('all');
          setSearchQuery('');
          setCurrentTab('catalog');
        }}
        currentTab={currentTab}
        onChangeTab={(tab) => {
          setCurrentTab(tab);
          setSelectedListing(null);
        }}
        selectedLocality={selectedLocality}
        onLocalityChange={setSelectedLocality}
        hasApiKey={Boolean(apiKey)}
        onOpenApiKey={() => openApiKeyModal()}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentTab === 'rooms' ? (
          <RoomsHub
            rooms={rooms}
            listings={listings}
            selectedRoomId={selectedRoomId}
            onSelectRoom={(id) => setSelectedRoomId(id)}
            onSendMessage={handleSendMessageToRoom}
            onOpenListing={handleOpenListing}
            onCreateRoom={handleCreateRoom}
            onRequireKey={(reason) => openApiKeyModal(reason)}
          />
        ) : currentTab === 'chat' ? (
          <McpChat
            listings={listings}
            rooms={rooms}
            onOpenListing={handleOpenListing}
            onOpenRoom={(roomId) => handleOpenRoom(roomId || '')}
            onListingCreated={(newListing) => {
              setListings((prev) => [newListing, ...prev.filter((l) => l.id !== newListing.id)]);
              handleOpenListing(newListing);
            }}
            onRefreshData={refreshDataFromDb}
            contextListing={contextListing}
            onClearContextListing={() => setContextListing(null)}
            onRequireKey={(reason) => openApiKeyModal(reason)}
          />
        ) : currentTab === 'mcp' ? (
          <McpConsole
            listings={listings}
            rooms={rooms}
            onAddListing={handlePublishListing}
            onSendMessageToRoom={handleSendMessageToRoom}
            onOpenListing={handleOpenListing}
          />
        ) : currentTab === 'principles' ? (
          <PrinciplesBanner />
        ) : selectedListing ? (
          <ListingDetail
            listing={selectedListing}
            rooms={rooms}
            onBack={() => setSelectedListing(null)}
            onContactSeller={handleContactSeller}
            onAgentDiscuss={handleAgentDiscuss}
            onOpenRoom={handleOpenRoom}
            onAddPhoto={handleAddPhotoToListing}
          />
        ) : (
          /* Catalog View */
          <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-[var(--ink)] tracking-tight">
                  {currentCategory === 'all'
                    ? 'Все объявления'
                    : CATEGORY_LABELS[currentCategory]}
                </h1>
                <p className="text-xs md:text-sm text-[var(--muted)] mt-1">
                  Найдено в базе данных SQLite: {filteredListings.length}
                </p>
              </div>

              {/* Offer vs Request Filter */}
              <div className="flex items-center gap-1.5 p-1 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterKind('all')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    filterKind === 'all'
                      ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  Все
                </button>
                <button
                  type="button"
                  onClick={() => setFilterKind('offer')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    filterKind === 'offer'
                      ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  📦 Предлагаю ({listings.filter((l) => l.content.kind === 'offer').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterKind('request')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    filterKind === 'request'
                      ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  🔍 Ищу ({listings.filter((l) => l.content.kind === 'request').length})
                </button>
              </div>
            </div>

            {/* Listings Grid / List */}
            {filteredListings.length > 0 ? (
              <div className="space-y-4">
                {filteredListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onOpen={handleOpenListing}
                    onDelegateToAngel={handleDelegateToAngel}
                  />
                ))}
              </div>
            ) : (
              <div className="border border-[var(--line)] rounded-2xl p-12 text-center bg-[var(--surface)] my-8">
                <div className="text-3xl mb-3">🔍</div>
                <h2 className="text-xl md:text-2xl font-bold text-[var(--ink)] mb-2">
                  В каталоге нет таких объявлений
                </h2>
                <p className="text-sm text-[var(--muted)] max-w-md mx-auto mb-6">
                  Попробуйте изменить поисковый запрос, выбрать другую категорию или дать поручение Агенту-Ангелу найти нужный контакт.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentCategory('all');
                      setSearchQuery('');
                      setFilterKind('all');
                      setSelectedLocality('all');
                    }}
                    className="px-5 py-2.5 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Сбросить фильтры
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentTab('chat')}
                    className="px-5 py-2.5 border border-[var(--line)] bg-[var(--canvas)] hover:bg-[var(--raised)] text-[var(--ink)] text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    👼 Поручить Агенту-Ангелу
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Server-side failures are shown, never silently swallowed */}
      {actionError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[calc(100%-2rem)]">
          <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200 px-4 py-3 text-sm shadow-lg">
            <span>⚠️</span>
            <span className="flex-1">{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-700 dark:text-red-300 hover:opacity-70 cursor-pointer"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSaved={(key) => {
          setApiKey(key);
          void refreshDataFromDb();
        }}
        reason={apiKeyReason}
      />

      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        onPublish={handlePublishListing}
      />

      <ContactModal
        isOpen={Boolean(contactModalListing)}
        listing={contactModalListing}
        onClose={() => setContactModalListing(null)}
        onSendMessage={handleSendSellerMessage}
      />

      <AgentModal
        isOpen={Boolean(agentModalListing)}
        listing={agentModalListing}
        onClose={() => setAgentModalListing(null)}
        onOpenConsole={() => {
          setSelectedListing(null);
          setCurrentTab('mcp');
        }}
        onOpenChat={() => {
          setSelectedListing(null);
          setCurrentTab('chat');
        }}
      />

      {/* Footer */}
      <footer className="border-t border-[var(--line)] bg-[var(--canvas)] py-6 mt-12 text-xs md:text-sm text-[var(--muted)]">
        <div className="max-w-[1120px] mx-auto px-4 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <strong>MCP Rooms</strong> · Серверный бэкенд на SQLite + Model Context Protocol (JSON-RPC 2.0).
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                setSelectedListing(null);
                setCurrentTab('rooms');
              }}
              className="hover:underline cursor-pointer font-bold text-[var(--ink)]"
            >
              🤝 Переговоры и темы
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedListing(null);
                setCurrentTab('chat');
              }}
              className="hover:underline cursor-pointer text-[var(--blue)] font-bold"
            >
              👼 Агент-Ангел
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedListing(null);
                setCurrentTab('principles');
              }}
              className="hover:underline cursor-pointer"
            >
              Принципы площадки
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedListing(null);
                setCurrentTab('mcp');
              }}
              className="hover:underline cursor-pointer"
            >
              MCP Консоль
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
