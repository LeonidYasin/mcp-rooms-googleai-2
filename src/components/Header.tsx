import React, { useState, useRef, useEffect } from 'react';
import { ListingCategory } from '../types';
import { useI18n, TranslationKey } from '../i18n';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { LangToggle } from './LangToggle';
import { FaceSwitcher } from './FaceSwitcher';
import { FaceId, getFaceConfig } from '../lib/faces';

interface HeaderProps {
  currentCategory: ListingCategory | 'all';
  onSelectCategory: (cat: ListingCategory | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  onOpenPublish: () => void;
  onGoHome: () => void;
  currentTab: 'catalog' | 'rooms' | 'mcp' | 'principles' | 'chat';
  onChangeTab: (tab: 'catalog' | 'rooms' | 'mcp' | 'principles' | 'chat') => void;
  selectedLocality: string;
  onLocalityChange: (loc: string) => void;
  hasApiKey: boolean;
  onOpenApiKey: () => void;
  onOpenAbout: () => void;
  currentFace?: FaceId;
  onSelectFace?: (face: FaceId) => void;
  onOpenAdvancedSearch?: () => void;
  activeFilterCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onOpenPublish,
  onGoHome,
  currentTab,
  onChangeTab,
  selectedLocality,
  onLocalityChange,
  hasApiKey,
  onOpenApiKey,
  onOpenAbout,
  currentFace = 'general',
  onSelectFace = () => {},
  onOpenAdvancedSearch,
  activeFilterCount = 0,
}) => {
  const { t, locale } = useI18n();
  const isEn = locale === 'en';
  const activeFace = getFaceConfig(currentFace);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Mobile / Tablet "More Options" Menu Popover
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isOutsideMore = !moreMenuRef.current || !moreMenuRef.current.contains(target);

      if (isOutsideMore) {
        setMoreMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMoreMenuOpen(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreMenuOpen]);

  const getCategoryLabel = (cat: ListingCategory | 'all'): string => {
    return t(`cat.${cat}` as TranslationKey);
  };

  const getSearchPlaceholder = (): string => {
    if (currentCategory !== 'all') {
      return isEn
        ? `Search in ${getCategoryLabel(currentCategory)}...`
        : `Искать в «${getCategoryLabel(currentCategory)}»...`;
    }
    return isEn
      ? (activeFace.searchPlaceholderEn || 'Search listings, services, goods...')
      : (activeFace.searchPlaceholderRu || 'Поиск объявлений, услуг, товаров...');
  };

  return (
    <>
      {/* Top Utility Coordination Bar (scrolls away naturally, not sticky, hidden in Dark Glass V2) */}
      {currentFace !== 'dark_glass' && (
        <div className="bg-[var(--surface)] border-b border-[var(--line)] py-1.5 px-3 sm:px-4 text-xs transition-colors">
        <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Location Picker + Face / Slogan Badge */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Location Selector (now positioned in Top Bar like Avito/CIAN) */}
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--ink)] bg-[var(--canvas)]/80 border border-[var(--line)] px-2 py-0.5 rounded-lg shrink-0">
              <span className="text-xs">📍</span>
              <select
                aria-label={t('nav.location')}
                value={selectedLocality}
                onChange={(e) => onLocalityChange(e.target.value)}
                className="bg-transparent text-[var(--ink)] font-bold outline-none cursor-pointer text-[11px]"
              >
                <option value="all">{t('nav.all_regions')}</option>
                <option value="Казань">Казань</option>
                <option value="Москва">Москва</option>
                <option value="Санкт-Петербург">Санкт-Петербург</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-sm leading-none shrink-0">{activeFace.emoji}</span>
              <strong
                className="font-bold text-[11px] sm:text-xs tracking-tight shrink-0 whitespace-nowrap"
                style={{ color: currentFace !== 'general' ? activeFace.accentColor : 'var(--blue)' }}
              >
                {currentFace !== 'general' ? (isEn ? activeFace.badgeEn : activeFace.badgeRu) : t('site.badge')}
              </strong>
              <span className="text-[var(--muted)] text-[11px] hidden 2xl:inline truncate min-w-0">
                {currentFace !== 'general' ? (isEn ? activeFace.taglineEn : activeFace.taglineRu) : t('site.badge_sub')}
              </span>
            </div>
          </div>

          {/* Right: Quick Nav Links + Sleek Theme & Lang Toggles */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-xs">
            <nav className="flex items-center gap-2 sm:gap-3.5 shrink-0 text-xs">
              <button
                type="button"
                onClick={() => onChangeTab('rooms')}
                className={`hover:underline cursor-pointer flex items-center gap-1 font-bold ${
                  currentTab === 'rooms' ? 'text-[var(--blue)]' : 'text-[var(--ink)]'
                }`}
              >
                <span>{t('nav.rooms')}</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeTab('chat')}
                className={`hover:underline cursor-pointer flex items-center gap-1 font-bold ${
                  currentTab === 'chat' ? 'text-[var(--blue)]' : 'text-[var(--ink)]'
                }`}
              >
                <span>{t('nav.chat')}</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeTab('mcp')}
                className={`hover:underline cursor-pointer hidden md:inline ${
                  currentTab === 'mcp' ? 'font-bold text-[var(--blue)]' : 'text-[var(--muted)]'
                }`}
              >
                {t('nav.mcp')}
              </button>
              <button
                type="button"
                onClick={() => onChangeTab('principles')}
                className={`hover:underline cursor-pointer hidden md:inline ${
                  currentTab === 'principles' ? 'font-bold text-[var(--blue)]' : 'text-[var(--muted)]'
                }`}
              >
                {t('nav.principles')}
              </button>
              <button
                type="button"
                onClick={onOpenAbout}
                className="hover:underline cursor-pointer font-bold text-[var(--muted)] hover:text-[var(--ink)] flex items-center gap-1"
              >
                <span>ℹ️</span>
                <span className="hidden sm:inline">{t('nav.about')}</span>
              </button>
            </nav>

            {/* Utility Toggles (Theme & Clean Lang) */}
            <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-[var(--line)]">
              <ThemeToggle />
              <LangToggle />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Main Slim Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--canvas)]/90 backdrop-blur-md transition-colors shadow-2xs">
        <div className="max-w-[1240px] mx-auto px-3 sm:px-4 md:px-6 py-2 md:py-2.5">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            {/* Logo */}
            <button
              type="button"
              onClick={onGoHome}
              className="text-left cursor-pointer transition-transform hover:opacity-95 focus:outline-none shrink-0 max-w-[140px] sm:max-w-[180px] truncate"
              title={t('site.title')}
            >
              <Logo
                size="sm"
                title={t('site.title')}
                subtitle=""
              />
            </button>

            {/* Desktop Unified Search Capsule (visible on lg+) */}
            <div className="hidden lg:flex flex-1 max-w-2xl mx-3 min-w-[340px]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSearchSubmit();
                }}
                className="w-full flex items-center bg-[var(--surface)] hover:bg-[var(--surface)]/95 focus-within:bg-[var(--canvas)] border border-[var(--line)] focus-within:border-[var(--blue)] focus-within:ring-2 focus-within:ring-[var(--focus)] rounded-xl transition-all h-9.5 pl-3 pr-1 shadow-2xs relative gap-2"
              >
                {/* 1. Leading Search Icon */}
                <div className="text-[var(--muted)] shrink-0 flex items-center select-none" aria-hidden="true">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>

                {/* 2. Wide Responsive Input */}
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={getSearchPlaceholder()}
                  maxLength={120}
                  className="flex-1 min-w-[160px] bg-transparent text-xs sm:text-sm text-[var(--ink)] placeholder-[var(--muted)] outline-none py-1 px-1 font-medium"
                />

                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    aria-label="Очистить поиск"
                    className="text-[var(--muted)] hover:text-[var(--ink)] text-xs p-1 hover:bg-[var(--raised)] rounded-md cursor-pointer shrink-0"
                  >
                    ✕
                  </button>
                )}

                {/* 3. Keyboard Shortcut Badge */}
                {!searchQuery && (
                  <div className="hidden 2xl:flex items-center gap-0.5 text-[10px] text-[var(--muted)] font-mono bg-[var(--raised)] border border-[var(--line)] px-1.5 py-0.5 rounded select-none shrink-0">
                    <span className="text-[11px]">⌘</span>K
                  </div>
                )}

                {/* 4. Advanced Search & Filters Button with Active Filter Count Badge */}
                <button
                  type="button"
                  onClick={onOpenAdvancedSearch}
                  title={isEn ? 'Advanced search & filters' : 'Расширенный поиск и фильтры'}
                  className={`h-7.5 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer shrink-0 select-none ${
                    activeFilterCount > 0
                      ? 'bg-[var(--soft)] text-[var(--blue)] font-bold border border-[var(--blue)]/30 shadow-2xs'
                      : 'text-[var(--ink)] hover:bg-[var(--raised)] border border-[var(--line)]'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <span className="hidden sm:inline">{isEn ? 'Filters' : 'Фильтры'}</span>
                  {activeFilterCount > 0 && (
                    <span className="min-w-4 h-4 px-1 rounded-full bg-[var(--blue)] text-white text-[10px] font-black flex items-center justify-center leading-none">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* 5. Prominent High-Contrast "Найти" CTA Button */}
                <button
                  type="submit"
                  aria-label={isEn ? 'Search' : 'Найти'}
                  title={isEn ? 'Search' : 'Найти'}
                  style={currentFace !== 'general' ? { backgroundColor: activeFace.accentColor } : undefined}
                  className="h-7.5 px-3.5 rounded-lg bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md active:scale-98 cursor-pointer shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>{isEn ? 'Search' : 'Найти'}</span>
                </button>
              </form>
            </div>

            {/* Actions Bar: Face Switcher, ApiKey, Publish */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Thematic Face Switcher (всегда виден) */}
              <FaceSwitcher currentFace={currentFace} onSelectFace={onSelectFace} />

              {/* Connection Status Button (всегда виден) */}
              <button
                type="button"
                onClick={onOpenApiKey}
                title={hasApiKey ? t('nav.key_saved') : t('nav.key_needed')}
                className={`font-semibold text-xs h-8 px-2 sm:px-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0 ${
                  hasApiKey
                    ? 'bg-[var(--surface)] border-emerald-500/40 text-[var(--ink)] hover:bg-[var(--raised)]'
                    : 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 hover:bg-blue-100'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: hasApiKey ? '#10b981' : '#3b82f6' }}
                />
                <span className="hidden sm:inline font-bold">{t('nav.key')}</span>
              </button>

              {/* Overflow More Options Menu (для экранов < lg, чтобы ничего не терялось) */}
              <div className="relative lg:hidden shrink-0" ref={moreMenuRef}>
                <button
                  type="button"
                  onClick={() => setMoreMenuOpen((prev) => !prev)}
                  title={isEn ? 'More options' : 'Дополнительные настройки'}
                  aria-label={isEn ? 'More options' : 'Дополнительные настройки'}
                  aria-expanded={moreMenuOpen}
                  className="h-8 w-8 rounded-lg border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] flex items-center justify-center font-bold text-sm transition-colors cursor-pointer select-none"
                >
                  ⋯
                </button>

                {moreMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-56 bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-2xl p-2 z-50 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-2"
                  >
                    <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)]">
                      {isEn ? 'Preferences' : 'Настройки'}
                    </div>

                    {/* Location in More Menu */}
                    <div className="flex items-center justify-between px-2 py-1 text-xs">
                      <span className="text-[var(--muted)] flex items-center gap-1">
                        <span>📍</span>
                        <span>{t('nav.location')}</span>
                      </span>
                      <select
                        aria-label={t('nav.location')}
                        value={selectedLocality}
                        onChange={(e) => onLocalityChange(e.target.value)}
                        className="bg-[var(--raised)] text-[var(--ink)] font-semibold rounded-md px-1.5 py-0.5 text-xs outline-none cursor-pointer"
                      >
                        <option value="all">{t('nav.all_regions')}</option>
                        <option value="Казань">Казань</option>
                        <option value="Москва">Москва</option>
                        <option value="Санкт-Петербург">Санкт-Петербург</option>
                      </select>
                    </div>

                    {/* Theme & Lang in More Menu */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--line)] px-1">
                      <ThemeToggle className="flex-1 justify-center" />
                      <LangToggle className="flex-1 justify-center" />
                    </div>
                  </div>
                )}
              </div>

              {/* Publish Action Button (всегда виден) */}
              <button
                type="button"
                onClick={onOpenPublish}
                style={currentFace !== 'general' ? { backgroundColor: activeFace.accentColor } : undefined}
                className="bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-bold text-xs h-8 px-2.5 sm:px-3 rounded-lg transition-all cursor-pointer shadow-xs hover:shadow-md flex items-center gap-1 active:scale-98 shrink-0"
              >
                <span className="text-sm font-semibold">＋</span>
                <span className="hidden sm:inline whitespace-nowrap">{t('nav.publish')}</span>
              </button>
            </div>
          </div>

          {/* Responsive Search Row (на экранах < lg под шапкой) */}
          <div className="mt-2 lg:hidden">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearchSubmit();
              }}
              className="w-full flex items-center bg-[var(--surface)] border border-[var(--line)] focus-within:border-[var(--blue)] focus-within:ring-2 focus-within:ring-[var(--focus)] rounded-xl h-9 pl-2.5 pr-1 shadow-2xs relative gap-1.5"
            >
              {/* Leading Magnifier Icon */}
              <div className="text-[var(--muted)] shrink-0 flex items-center select-none" aria-hidden="true">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={getSearchPlaceholder()}
                className="flex-1 bg-transparent text-xs text-[var(--ink)] placeholder-[var(--muted)] outline-none py-1 px-1 min-w-0 font-medium"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Очистить"
                  className="text-[var(--muted)] hover:text-[var(--ink)] text-xs px-1 cursor-pointer"
                >
                  ✕
                </button>
              )}

              {/* Mobile Filter Button */}
              <button
                type="button"
                onClick={onOpenAdvancedSearch}
                title={isEn ? 'Advanced search & filters' : 'Расширенный поиск и фильтры'}
                className={`h-7 px-2 rounded-lg flex items-center gap-1 text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
                  activeFilterCount > 0
                    ? 'bg-[var(--soft)] text-[var(--blue)] font-bold border border-[var(--blue)]/30 shadow-2xs'
                    : 'text-[var(--ink)] hover:bg-[var(--raised)] border border-[var(--line)]'
                }`}
              >
                <svg className="w-3.5 h-3.5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                {activeFilterCount > 0 && (
                  <span className="min-w-3.5 h-3.5 px-0.5 rounded-full bg-[var(--blue)] text-white text-[9px] font-black flex items-center justify-center leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Mobile Prominent "Найти" CTA Button */}
              <button
                type="submit"
                aria-label={isEn ? 'Search' : 'Найти'}
                title={isEn ? 'Search' : 'Найти'}
                style={currentFace !== 'general' ? { backgroundColor: activeFace.accentColor } : undefined}
                className="h-7 px-2.5 rounded-lg bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-black text-xs flex items-center gap-1 transition-all shadow-xs cursor-pointer shrink-0"
              >
                <span>{isEn ? 'Search' : 'Найти'}</span>
              </button>
            </form>
          </div>
        </div>
      </header>
    </>
  );
};
