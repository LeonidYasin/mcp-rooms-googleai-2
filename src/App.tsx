import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Listing,
  ListingCategory,
  McpRoom,
  McpMessage,
  CATEGORY_LABELS,
  FulfilmentMode,
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
import { AboutModal } from './components/AboutModal';
import { RoomsHub } from './components/RoomsHub';
import { FaceBanner } from './components/FaceBanner';
import { VerticalModuleWidget } from './components/VerticalModuleWidget';
import { CategoryBar } from './components/CategoryBar';
import { AdvancedSearchModal, AdvancedSearchFilters } from './components/AdvancedSearchModal';
import {
  FaceId,
  getFaceConfig,
  getStoredFace,
  setStoredFace,
  getFaceFromUrl,
  QuickChip,
} from './lib/faces';
import { useI18n, TranslationKey, getLocalizedListing, getLocalizedRoom } from './i18n';
import {
  authHeaders,
  getStoredApiKey,
  isUnauthorized,
  readApiFailure,
} from './lib/api';

export const App: React.FC = () => {
  const { t, locale } = useI18n();
  const [listings, setListings] = useState<Listing[]>(INITIAL_LISTINGS);
  // Thematic Face state initialized from URL or localStorage
  const [currentFace, setCurrentFace] = useState<FaceId>(() => getFaceFromUrl() || getStoredFace());
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
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [priceOnly, setPriceOnly] = useState<boolean>(false);
  const [selectedModes, setSelectedModes] = useState<FulfilmentMode[]>([]);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'popular'>('newest');

  // Modals
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
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

  // Synchronize dynamic visual skin on the <html> element
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (currentFace === 'general') {
        document.documentElement.removeAttribute('data-face');
      } else {
        document.documentElement.setAttribute('data-face', currentFace);
      }
    }
  }, [currentFace]);

  // Localized listings and rooms based on active language (with strict deduplication guard)
  const localizedListings = useMemo(() => {
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const unique: Listing[] = [];

    for (const raw of listings) {
      if (!raw || seenIds.has(raw.id)) continue;
      const loc = getLocalizedListing(raw, locale);
      const titleKey = `${loc.content?.category}:::${loc.content?.kind}:::${(loc.content?.title || '').trim().toLowerCase()}`;
      if (seenTitles.has(titleKey)) continue;

      seenIds.add(raw.id);
      seenTitles.add(titleKey);
      unique.push(loc);
    }
    return unique;
  }, [listings, locale]);

  const localizedRooms = useMemo(
    () => rooms.map((r) => getLocalizedRoom(r, locale)),
    [rooms, locale]
  );

  const activeSelectedListing = useMemo(() => {
    if (!selectedListing) return null;
    const found = localizedListings.find((l) => l.id === selectedListing.id);
    return found || getLocalizedListing(selectedListing, locale);
  }, [selectedListing, localizedListings, locale]);

  const handleSelectFace = useCallback((face: FaceId) => {
    setCurrentFace(face);
    setStoredFace(face);
    setCurrentCategory('all');
    setSearchQuery('');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (face === 'general') {
        url.searchParams.delete('face');
        url.searchParams.delete('theme');
        url.searchParams.delete('niche');
      } else {
        url.searchParams.set('face', face);
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Active filters count for badges
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (currentCategory !== 'all') count++;
    if (currentFace !== 'general') count++;
    if (filterKind !== 'all') count++;
    if (selectedLocality !== 'all') count++;
    if (minPrice !== null && minPrice > 0) count++;
    if (maxPrice !== null) count++;
    if (priceOnly) count++;
    if (selectedModes.length > 0) count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [currentCategory, currentFace, filterKind, selectedLocality, minPrice, maxPrice, priceOnly, selectedModes, sortBy]);

  // Advanced search filters object for modal
  const advancedFilters: AdvancedSearchFilters = useMemo(() => ({
    query: searchQuery,
    category: currentCategory,
    face: currentFace,
    kind: filterKind,
    locality: selectedLocality,
    minPrice,
    maxPrice,
    priceOnly,
    modes: selectedModes,
    sortBy,
  }), [searchQuery, currentCategory, currentFace, filterKind, selectedLocality, minPrice, maxPrice, priceOnly, selectedModes, sortBy]);

  const handleUpdateAdvancedFilters = useCallback((f: AdvancedSearchFilters) => {
    setSearchQuery(f.query);
    setCurrentCategory(f.category);
    if (f.face !== currentFace) {
      handleSelectFace(f.face);
    }
    setFilterKind(f.kind);
    setSelectedLocality(f.locality);
    setMinPrice(f.minPrice);
    setMaxPrice(f.maxPrice);
    setPriceOnly(f.priceOnly);
    setSelectedModes(f.modes);
    setSortBy(f.sortBy);
  }, [currentFace, handleSelectFace]);

  const handleResetAllFilters = useCallback(() => {
    setSearchQuery('');
    setCurrentCategory('all');
    handleSelectFace('general');
    setFilterKind('all');
    setSelectedLocality('all');
    setMinPrice(null);
    setMaxPrice(null);
    setPriceOnly(false);
    setSelectedModes([]);
    setSortBy('newest');
  }, [handleSelectFace]);

  // Filtered and sorted listings
  const filteredListings = useMemo(() => {
    const faceConfig = getFaceConfig(currentFace);
    const result = localizedListings.filter((item) => {
      // Thematic Face filter
      if (currentFace !== 'general' && !faceConfig.primaryCategories.includes(item.content.category)) {
        return false;
      }
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
      // Price filter (price_minor is in kopecks / cents)
      const priceRub = item.content.price_minor !== null && item.content.price_minor !== undefined
        ? Math.floor(item.content.price_minor / 100)
        : null;
      if (priceOnly && priceRub === null) {
        return false;
      }
      if (minPrice !== null && (priceRub === null || priceRub < minPrice)) {
        return false;
      }
      if (maxPrice !== null && (priceRub === null || priceRub > maxPrice)) {
        return false;
      }
      // Fulfillment modes filter
      if (selectedModes.length > 0) {
        const itemModes = item.content.modes || [];
        const hasMatchingMode = selectedModes.some((m) => itemModes.includes(m));
        if (!hasMatchingMode) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = item.content.title.toLowerCase().includes(q);
        const inDesc = item.content.description.toLowerCase().includes(q);
        const inCat =
          CATEGORY_LABELS[item.content.category]?.toLowerCase().includes(q) ||
          t(`cat.${item.content.category}` as TranslationKey).toLowerCase().includes(q);
        const inSubcat = item.content.subcategory?.toLowerCase().includes(q);
        const inLoc = item.content.locality?.toLowerCase().includes(q);
        return Boolean(inTitle || inDesc || inCat || inSubcat || inLoc);
      }
      return true;
    });

    // Sorting
    const sorted = [...result];
    if (sortBy === 'price_asc') {
      sorted.sort((a, b) => {
        const aP = a.content.price_minor ?? Infinity;
        const bP = b.content.price_minor ?? Infinity;
        return aP - bP;
      });
    } else if (sortBy === 'price_desc') {
      sorted.sort((a, b) => {
        const aP = a.content.price_minor ?? -1;
        const bP = b.content.price_minor ?? -1;
        return bP - aP;
      });
    } else if (sortBy === 'popular') {
      sorted.sort((a, b) => (b.responses_count || 0) - (a.responses_count || 0));
    } else {
      // Newest first (default)
      sorted.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    }

    return sorted;
  }, [
    localizedListings,
    currentFace,
    currentCategory,
    filterKind,
    selectedLocality,
    minPrice,
    maxPrice,
    priceOnly,
    selectedModes,
    sortBy,
    searchQuery,
    t,
  ]);

  const handleApplyChip = useCallback((chip: QuickChip) => {
    setSearchQuery(chip.query);
    if (chip.category) {
      setCurrentCategory(chip.category);
    }
  }, []);

  const handleOpenListing = (listing: Listing) => {
    const raw = listings.find((l) => l.id === listing.id) || listing;
    setSelectedListing(raw);
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
        onOpenAbout={() => setIsAboutModalOpen(true)}
        currentFace={currentFace}
        onSelectFace={handleSelectFace}
        onOpenAdvancedSearch={() => setIsAdvancedSearchOpen(true)}
        activeFilterCount={activeFilterCount}
      />

      {/* Main Content Area with Ambient Mesh Glow */}
      <main className="flex-1 ambient-mesh-glow">
        {currentTab === 'rooms' ? (
          <RoomsHub
            rooms={localizedRooms}
            listings={localizedListings}
            selectedRoomId={selectedRoomId}
            onSelectRoom={(id) => setSelectedRoomId(id)}
            onSendMessage={handleSendMessageToRoom}
            onOpenListing={handleOpenListing}
            onCreateRoom={handleCreateRoom}
            onRequireKey={(reason) => openApiKeyModal(reason)}
          />
        ) : currentTab === 'chat' ? (
          <McpChat
            listings={localizedListings}
            rooms={localizedRooms}
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
            listings={localizedListings}
            rooms={localizedRooms}
            onAddListing={handlePublishListing}
            onSendMessageToRoom={handleSendMessageToRoom}
            onOpenListing={handleOpenListing}
          />
        ) : currentTab === 'principles' ? (
          <PrinciplesBanner />
        ) : activeSelectedListing ? (
          <ListingDetail
            listing={activeSelectedListing}
            rooms={localizedRooms}
            onBack={() => setSelectedListing(null)}
            onContactSeller={handleContactSeller}
            onAgentDiscuss={handleAgentDiscuss}
            onOpenRoom={handleOpenRoom}
            onAddPhoto={handleAddPhotoToListing}
          />
        ) : (
          /* Catalog View */
          <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-6">
            {/* Thematic Face Banner */}
            <FaceBanner
              currentFace={currentFace}
              onSelectFace={handleSelectFace}
              onApplyChip={handleApplyChip}
              activeChipQuery={searchQuery}
              onOpenPublish={() => setIsPublishModalOpen(true)}
            />

            {/* Specialized Vertical Action Module */}
            <VerticalModuleWidget
              currentFace={currentFace}
              onOpenPublish={() => setIsPublishModalOpen(true)}
              onOpenRoom={handleOpenRoom}
              onSelectFace={handleSelectFace}
            />

            {/* Elegant Horizontal Category Carousel */}
            <CategoryBar
              currentCategory={currentCategory}
              onSelectCategory={(cat) => {
                setCurrentCategory(cat);
                setSelectedListing(null);
              }}
              accentColor={currentFace !== 'general' ? getFaceConfig(currentFace).accentColor : undefined}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-[var(--ink)] tracking-tight flex items-center gap-2">
                  {currentFace !== 'general' && currentCategory === 'all' ? (
                    <>
                      <span>{getFaceConfig(currentFace).emoji}</span>
                      <span>{locale === 'en' ? getFaceConfig(currentFace).nameEn : getFaceConfig(currentFace).nameRu}</span>
                    </>
                  ) : currentCategory === 'all' ? (
                    t('cat.all')
                  ) : (
                    t(`cat.${currentCategory}` as TranslationKey)
                  )}
                </h1>
                <p className="text-xs md:text-sm text-[var(--muted)] mt-1">
                  {locale === 'en'
                    ? `Found in SQLite database: ${filteredListings.length}`
                    : `Найдено в базе данных SQLite: ${filteredListings.length}`}
                </p>
              </div>

              {/* Actions & Filters Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Offer vs Request Filter */}
                <div className="flex items-center gap-1.5 p-1 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setFilterKind('all')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      filterKind === 'all'
                        ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-xs font-bold'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {t('kind.all')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterKind('offer')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      filterKind === 'offer'
                        ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-xs font-bold text-emerald-700 dark:text-emerald-300'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    📦 {t('kind.offer')} ({listings.filter((l) => l.content.kind === 'offer').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterKind('request')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      filterKind === 'request'
                        ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-xs font-bold text-blue-700 dark:text-blue-300'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    🔍 {t('kind.request')} ({listings.filter((l) => l.content.kind === 'request').length})
                  </button>
                </div>

                {/* Advanced Search & Filters Button */}
                <button
                  type="button"
                  onClick={() => setIsAdvancedSearchOpen(true)}
                  className={`h-9 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                    activeFilterCount > 0
                      ? 'bg-[var(--soft)] text-[var(--blue)] border-[var(--blue)]/40 font-black shadow-xs'
                      : 'bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] border-[var(--line)]'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <span>{locale === 'en' ? 'Filters' : 'Фильтры'}</span>
                  {activeFilterCount > 0 && (
                    <span className="min-w-4 h-4 px-1 rounded-full bg-[var(--blue)] text-white text-[10px] font-black flex items-center justify-center leading-none">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Active Filter Badges Bar */}
            {(activeFilterCount > 0 || searchQuery) && (
              <div className="flex flex-wrap items-center gap-1.5 mb-6 p-2.5 rounded-xl bg-[var(--surface)]/60 border border-[var(--line)] text-xs">
                <span className="text-[var(--muted)] font-semibold mr-1">
                  {locale === 'en' ? 'Active filters:' : 'Применены фильтры:'}
                </span>

                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--canvas)] border border-[var(--line)] text-[var(--ink)] font-medium">
                    <span>🔍 «{searchQuery}»</span>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-[var(--muted)] hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {currentFace !== 'general' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--canvas)] border border-[var(--line)] text-[var(--ink)] font-medium">
                    <span>{getFaceConfig(currentFace).emoji} {locale === 'en' ? getFaceConfig(currentFace).nameEn : getFaceConfig(currentFace).nameRu}</span>
                    <button
                      type="button"
                      onClick={() => handleSelectFace('general')}
                      className="text-[var(--muted)] hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {currentCategory !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--canvas)] border border-[var(--line)] text-[var(--ink)] font-medium">
                    <span>📁 {t(`cat.${currentCategory}` as TranslationKey)}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentCategory('all')}
                      className="text-[var(--muted)] hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {selectedLocality !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--canvas)] border border-[var(--line)] text-[var(--ink)] font-medium">
                    <span>📍 {selectedLocality}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedLocality('all')}
                      className="text-[var(--muted)] hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {(minPrice !== null || maxPrice !== null) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--canvas)] border border-[var(--line)] text-[var(--ink)] font-medium">
                    <span>
                      💰 {minPrice !== null ? `от ${minPrice.toLocaleString()} ₽` : ''}{' '}
                      {maxPrice !== null ? `до ${maxPrice.toLocaleString()} ₽` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMinPrice(null);
                        setMaxPrice(null);
                      }}
                      className="text-[var(--muted)] hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {priceOnly && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--canvas)] border border-[var(--line)] text-[var(--ink)] font-medium">
                    <span>Только с ценой</span>
                    <button
                      type="button"
                      onClick={() => setPriceOnly(false)}
                      className="text-[var(--muted)] hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {selectedModes.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--canvas)] border border-[var(--line)] text-[var(--ink)] font-medium">
                    <span>🤝 {selectedModes.map((m) => t(`mode.${m}` as TranslationKey)).join(', ')}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedModes([])}
                      className="text-[var(--muted)] hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {sortBy !== 'newest' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--canvas)] border border-[var(--line)] text-[var(--ink)] font-medium">
                    <span>
                      {sortBy === 'price_asc' ? '💰 Сначала дешевле' : sortBy === 'price_desc' ? '💎 Сначала дороже' : '🔥 По популярности'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSortBy('newest')}
                      className="text-[var(--muted)] hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                    >
                      ✕
                    </button>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className="ml-auto text-[11px] font-bold text-red-500 hover:underline cursor-pointer px-2 py-0.5"
                >
                  {locale === 'en' ? 'Reset all' : 'Сбросить все'}
                </button>
              </div>
            )}

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
                  {t('empty.title')}
                </h2>
                <p className="text-sm text-[var(--muted)] max-w-md mx-auto mb-6">
                  {t('empty.desc')}
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
                    {t('empty.reset_btn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentTab('chat')}
                    className="px-5 py-2.5 border border-[var(--line)] bg-[var(--canvas)] hover:bg-[var(--raised)] text-[var(--ink)] text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    👼 {locale === 'en' ? 'Ask Angel Agent' : 'Поручить Агенту-Ангелу'}
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
      {/* Advanced Search & Filtering Modal */}
      <AdvancedSearchModal
        isOpen={isAdvancedSearchOpen}
        onClose={() => setIsAdvancedSearchOpen(false)}
        filters={advancedFilters}
        onChangeFilters={handleUpdateAdvancedFilters}
        onApply={() => {
          setSelectedListing(null);
          setCurrentTab('catalog');
        }}
        onReset={handleResetAllFilters}
        totalMatching={filteredListings.length}
      />

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
        currentFace={currentFace}
      />

      <ContactModal
        isOpen={Boolean(contactModalListing)}
        listing={contactModalListing ? getLocalizedListing(contactModalListing, locale) : null}
        onClose={() => setContactModalListing(null)}
        onSendMessage={handleSendSellerMessage}
      />

      <AgentModal
        isOpen={Boolean(agentModalListing)}
        listing={agentModalListing ? getLocalizedListing(agentModalListing, locale) : null}
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

      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        onOpenConnect={() => openApiKeyModal()}
      />

      {/* Modern Sleek Footer */}
      <footer className="border-t border-[var(--line)] bg-[var(--canvas)] py-6 mt-12 text-xs md:text-sm text-[var(--muted)]">
        <div className="max-w-[1120px] mx-auto px-4 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <strong className="text-[var(--ink)] font-bold">MCP Rooms</strong>
            <span>·</span>
            <span>{t('footer.tagline')}</span>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <button
              type="button"
              onClick={() => setIsAboutModalOpen(true)}
              className="hover:underline cursor-pointer font-bold text-[var(--ink)]"
            >
              ℹ️ {t('nav.about')}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedListing(null);
                setCurrentTab('rooms');
              }}
              className="hover:underline cursor-pointer font-bold text-[var(--ink)]"
            >
              {t('nav.rooms')}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedListing(null);
                setCurrentTab('chat');
              }}
              className="hover:underline cursor-pointer text-[var(--blue)] font-bold"
            >
              👼 {locale === 'en' ? 'Angel Agent' : 'Агент-Ангел'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedListing(null);
                setCurrentTab('principles');
              }}
              className="hover:underline cursor-pointer"
            >
              {t('nav.principles')}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedListing(null);
                setCurrentTab('mcp');
              }}
              className="hover:underline cursor-pointer"
            >
              {t('nav.mcp')}
            </button>
            <a
              href="https://github.com/LeonidYasin/mcp-rooms-googleai-2"
              target="_blank"
              rel="noreferrer"
              className="hover:underline text-[var(--muted)] hover:text-[var(--ink)]"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
