import React, { useEffect } from 'react';
import { ListingCategory, CATEGORY_LABELS, FulfilmentMode, MODE_LABELS } from '../types';
import { CATEGORIES_ORDER, CATEGORY_ICONS } from './CategoryBar';
import { FaceId, ALL_FACES } from '../lib/faces';
import { useI18n, TranslationKey } from '../i18n';

export interface AdvancedSearchFilters {
  query: string;
  category: ListingCategory | 'all';
  face: FaceId;
  kind: 'all' | 'offer' | 'request';
  locality: string;
  minPrice: number | null;
  maxPrice: number | null;
  priceOnly: boolean;
  modes: FulfilmentMode[];
  sortBy: 'newest' | 'price_asc' | 'price_desc' | 'popular';
}

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: AdvancedSearchFilters;
  onChangeFilters: (filters: AdvancedSearchFilters) => void;
  onApply: () => void;
  onReset: () => void;
  totalMatching: number;
}

export const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  isOpen,
  onClose,
  filters,
  onChangeFilters,
  onApply,
  onReset,
  totalMatching,
}) => {
  const { t, locale } = useI18n();
  const isEn = locale === 'en';

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const update = <K extends keyof AdvancedSearchFilters>(key: K, value: AdvancedSearchFilters[K]) => {
    onChangeFilters({
      ...filters,
      [key]: value,
    });
  };

  const toggleMode = (mode: FulfilmentMode) => {
    const exists = filters.modes.includes(mode);
    const newModes = exists
      ? filters.modes.filter((m) => m !== mode)
      : [...filters.modes, mode];
    update('modes', newModes);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="advanced-search-title"
    >
      <div className="bg-[var(--canvas)] border border-[var(--line)] rounded-2xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl my-auto max-h-[92vh] flex flex-col gap-5 text-[var(--ink)] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--soft)] text-[var(--blue)] flex items-center justify-center font-bold text-base">
              ⚙️
            </div>
            <div>
              <h2 id="advanced-search-title" className="text-lg sm:text-xl font-black tracking-tight text-[var(--ink)]">
                {isEn ? 'Advanced Search & Filters' : 'Расширенный поиск и фильтры'}
              </h2>
              <p className="text-xs text-[var(--muted)]">
                {isEn
                  ? 'Fine-tune catalog listings across categories, intent, pricing, and locations'
                  : 'Точная настройка параметров поиска, разделов, цен и условий сделки'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--raised)] flex items-center justify-center text-sm transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-5 pr-1 max-h-[65vh]">
          {/* 1. Keyword Query */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              {isEn ? 'Search Keyword / Phrase' : 'Ключевые слова или фраза'}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-[var(--muted)] text-sm">🔍</span>
              <input
                type="text"
                value={filters.query}
                onChange={(e) => update('query', e.target.value)}
                placeholder={isEn ? 'e.g. H100, bicycle, lawyer, apartment...' : 'Например: коворкинг, Казань, велосипед, сервер...'}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-medium text-[var(--ink)] placeholder-[var(--muted)] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--focus)] transition-all"
              />
              {filters.query && (
                <button
                  type="button"
                  onClick={() => update('query', '')}
                  className="absolute right-2.5 text-xs text-[var(--muted)] hover:text-[var(--ink)] p-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 2. Intent (Offer vs Request) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              {isEn ? 'Listing Type (Intent)' : 'Тип объявления (Интент)'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'all', labelRu: 'Все типы', labelEn: 'All types', icon: '🔄' },
                { id: 'offer', labelRu: 'Только предложения (Предлагаю)', labelEn: 'Offers only', icon: '🟢' },
                { id: 'request', labelRu: 'Только запросы (Ищу)', labelEn: 'Requests only', icon: '🟣' },
              ].map((opt) => {
                const isSelected = filters.kind === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update('kind', opt.id as any)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 text-center ${
                      isSelected
                        ? 'bg-[var(--blue)] text-white border-transparent shadow-xs scale-[1.01]'
                        : 'bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] border-[var(--line)]'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span className="truncate">{isEn ? opt.labelEn : opt.labelRu}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Section / Category */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                {isEn ? 'Catalog Section' : 'Раздел каталога'}
              </label>
              {filters.category !== 'all' && (
                <button
                  type="button"
                  onClick={() => update('category', 'all')}
                  className="text-[11px] text-[var(--blue)] hover:underline font-bold cursor-pointer"
                >
                  {isEn ? 'Reset to All' : 'Сбросить на «Все»'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
              {CATEGORIES_ORDER.map((cat) => {
                const isSelected = filters.category === cat;
                const label = cat === 'all'
                  ? (isEn ? 'All Sections' : 'Все разделы')
                  : (isEn ? t(`cat.${cat}` as TranslationKey) : CATEGORY_LABELS[cat]);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => update('category', cat)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-semibold border text-left flex items-center gap-2 transition-all cursor-pointer truncate ${
                      isSelected
                        ? 'bg-[var(--soft)] border-[var(--blue)] text-[var(--blue)] font-bold shadow-2xs'
                        : 'bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] border-[var(--line)]'
                    }`}
                  >
                    <span className="text-base shrink-0">{CATEGORY_ICONS[cat]}</span>
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Thematic Face Vertical */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                {isEn ? 'Thematic Face (Niche)' : 'Тематическая витрина'}
              </label>
              {filters.face !== 'general' && (
                <button
                  type="button"
                  onClick={() => update('face', 'general')}
                  className="text-[11px] text-[var(--blue)] hover:underline font-bold cursor-pointer"
                >
                  {isEn ? 'All Themes' : 'Все темы'}
                </button>
              )}
            </div>
            <select
              value={filters.face}
              onChange={(e) => update('face', e.target.value as FaceId)}
              className="w-full h-10 px-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--blue)] cursor-pointer"
            >
              {ALL_FACES.map((face) => (
                <option key={face.id} value={face.id}>
                  {face.emoji} {isEn ? face.nameEn : face.nameRu} ({isEn ? face.taglineEn : face.taglineRu})
                </option>
              ))}
            </select>
          </div>

          {/* 5. Price Range */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              {isEn ? 'Price Range (₽)' : 'Диапазон цены (₽)'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs text-[var(--muted)] font-semibold select-none">От</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={filters.minPrice !== null ? filters.minPrice : ''}
                  onChange={(e) => update('minPrice', e.target.value ? Number(e.target.value) : null)}
                  placeholder="0"
                  className="w-full h-10 pl-8 pr-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--blue)]"
                />
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs text-[var(--muted)] font-semibold select-none">До</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={filters.maxPrice !== null ? filters.maxPrice : ''}
                  onChange={(e) => update('maxPrice', e.target.value ? Number(e.target.value) : null)}
                  placeholder="Без ограничений"
                  className="w-full h-10 pl-8 pr-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--blue)]"
                />
              </div>
            </div>

            <label className="mt-2 flex items-center gap-2 cursor-pointer select-none text-xs text-[var(--muted)] hover:text-[var(--ink)]">
              <input
                type="checkbox"
                checked={filters.priceOnly}
                onChange={(e) => update('priceOnly', e.target.checked)}
                className="w-4 h-4 rounded text-[var(--blue)] focus:ring-[var(--focus)] cursor-pointer"
              />
              <span>{isEn ? 'Only listings with fixed price (exclude negotiable / free)' : 'Только с указанной ценой (исключить договорные и бесплатные)'}</span>
            </label>
          </div>

          {/* 6. Locality / Region */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              {isEn ? 'Location / Region' : 'Город или регион'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              {[
                { id: 'all', label: isEn ? 'All Regions' : 'Все регионы' },
                { id: 'Казань', label: 'Казань' },
                { id: 'Москва', label: 'Москва' },
                { id: 'Санкт-Петербург', label: 'Санкт-Петербург' },
              ].map((loc) => {
                const isSelected = filters.locality.toLowerCase() === loc.id.toLowerCase();
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => update('locality', loc.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-[var(--soft)] border-[var(--blue)] text-[var(--blue)] font-bold shadow-2xs'
                        : 'bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] border-[var(--line)]'
                    }`}
                  >
                    📍 {loc.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7. Fulfillment Modes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              {isEn ? 'Fulfillment & Handover' : 'Способ получения / Формат сделки'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['pickup', 'shipping', 'online'] as FulfilmentMode[]).map((mode) => {
                const isSelected = filters.modes.includes(mode);
                const icons: Record<FulfilmentMode, string> = {
                  pickup: '🤝',
                  shipping: '🚚',
                  online: '💻',
                };
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => toggleMode(mode)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-[var(--soft)] border-[var(--blue)] text-[var(--blue)] shadow-2xs'
                        : 'bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] border-[var(--line)]'
                    }`}
                  >
                    <span>{icons[mode]}</span>
                    <span>{MODE_LABELS[mode]}</span>
                    {isSelected && <span className="ml-1 text-[11px] font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 8. Sorting */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              {isEn ? 'Sorting' : 'Сортировка результатов'}
            </label>
            <select
              value={filters.sortBy}
              onChange={(e) => update('sortBy', e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--blue)] cursor-pointer"
            >
              <option value="newest">🕒 {isEn ? 'Newest first (by publish date)' : 'Сначала новые (по дате)'}</option>
              <option value="price_asc">💰 {isEn ? 'Price: low to high' : 'Сначала дешевле (по возрастанию цены)'}</option>
              <option value="price_desc">💎 {isEn ? 'Price: high to low' : 'Сначала дороже (по убыванию цены)'}</option>
              <option value="popular">🔥 {isEn ? 'Most discussed (by active rooms)' : 'По популярности (по количеству комнат)'}</option>
            </select>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-bold text-[var(--muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 px-3 py-2 rounded-xl transition-colors cursor-pointer"
          >
            {isEn ? 'Reset All Filters' : 'Сбросить все'}
          </button>

          <button
            type="button"
            onClick={() => {
              onApply();
              onClose();
            }}
            className="bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white text-xs sm:text-sm font-black px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md active:scale-98 flex items-center gap-2"
          >
            <span>🔍</span>
            <span>
              {isEn
                ? `Show ${totalMatching} ${totalMatching === 1 ? 'listing' : 'listings'}`
                : `Показать ${totalMatching} ${totalMatching === 1 ? 'объявление' : totalMatching >= 2 && totalMatching <= 4 ? 'объявления' : 'объявлений'}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
