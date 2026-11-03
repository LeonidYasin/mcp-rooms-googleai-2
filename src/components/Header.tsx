import React, { useState, useRef, useEffect } from 'react';
import { ListingCategory } from '../types';
import { useI18n, TranslationKey } from '../i18n';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { LangToggle } from './LangToggle';
import { FaceSwitcher } from './FaceSwitcher';
import { FaceId, getFaceConfig } from '../lib/faces';
import { CATEGORY_ICONS, CATEGORIES_ORDER } from './CategoryBar';

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
}) => {
  const { t, locale } = useI18n();
  const isEn = locale === 'en';
  const activeFace = getFaceConfig(currentFace);

  // Category Popover State with Click-Outside detection
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

  // Mobile / Tablet "More Options" Menu Popover
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isOutsideDesktop = !desktopRef.current || !desktopRef.current.contains(target);
      const isOutsideMobile = !mobileRef.current || !mobileRef.current.contains(target);
      const isOutsideMore = !moreMenuRef.current || !moreMenuRef.current.contains(target);

      if (isOutsideDesktop && isOutsideMobile) {
        setCategoriesOpen(false);
      }
      if (isOutsideMore) {
        setMoreMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setCategoriesOpen(false);
        setMoreMenuOpen(false);
      }
    }

    if (categoriesOpen || moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [categoriesOpen, moreMenuOpen]);

  const getCategoryLabel = (cat: ListingCategory | 'all'): string => {
    return t(`cat.${cat}` as TranslationKey);
  };

  const renderCategoryDropdownMenu = () => (
    <div
      role="menu"
      className="absolute top-full left-0 mt-2 w-64 bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-2xl py-1.5 z-50 backdrop-blur-md max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-3.5 py-1.5 border-b border-[var(--line)] text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
        {isEn ? 'Filter by Section' : 'Раздел каталога'}
      </div>
      {CATEGORIES_ORDER.map((cat) => {
        const isSelected = currentCategory === cat;
        return (
          <button
            key={cat}
            type="button"
            role="menuitem"
            onClick={() => {
              onSelectCategory(cat);
              setCategoriesOpen(false);
            }}
            className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
              isSelected
                ? 'font-bold text-[var(--blue)] bg-[var(--soft)]'
                : 'text-[var(--ink)] hover:bg-[var(--raised)]'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <span className="text-sm">{CATEGORY_ICONS[cat]}</span>
              <span className="truncate">{getCategoryLabel(cat)}</span>
            </span>
            {isSelected && <span className="text-xs text-[var(--blue)] font-bold">✓</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Top Utility Coordination Bar (scrolls away naturally, not sticky) */}
      <div className="bg-[var(--surface)] border-b border-[var(--line)] py-1.5 px-4 text-xs transition-colors">
        <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 truncate">
            <span className="text-sm leading-none">{activeFace.emoji}</span>
            <strong className="text-[var(--blue)] font-bold text-[11px] sm:text-xs tracking-tight">
              {currentFace !== 'general' ? (isEn ? activeFace.badgeEn : activeFace.badgeRu) : t('site.badge')}
            </strong>
            <span className="text-[var(--muted)] text-[11px] hidden lg:inline truncate">
              {currentFace !== 'general' ? (isEn ? activeFace.taglineEn : activeFace.taglineRu) : t('site.badge_sub')}
            </span>
          </div>

          {/* Quick Nav Links */}
          <nav className="flex items-center gap-2.5 sm:gap-4 shrink-0 text-xs">
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
              className={`hover:underline cursor-pointer ${
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
        </div>
      </div>

      {/* Main Slim Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--canvas)]/90 backdrop-blur-md transition-colors shadow-2xs">
        <div className="max-w-[1240px] mx-auto px-3 sm:px-4 md:px-6 py-2 md:py-2.5">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            {/* Logo */}
            <button
              type="button"
              onClick={onGoHome}
              className="text-left cursor-pointer transition-transform hover:opacity-95 focus:outline-none shrink-0 max-w-[150px] sm:max-w-[200px] truncate"
              title={currentFace !== 'general' ? `${activeFace.emoji} ${isEn ? activeFace.nameEn : activeFace.nameRu}` : t('site.title')}
            >
              <Logo
                size="sm"
                title={currentFace !== 'general' ? `${activeFace.emoji} ${isEn ? activeFace.nameEn : activeFace.nameRu}` : t('site.title')}
              />
            </button>

            {/* Desktop Unified Search Capsule (visible on md+) */}
            <div className="hidden md:flex flex-1 max-w-xl mx-2 min-w-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSearchSubmit();
                }}
                className="w-full flex items-center bg-[var(--surface)] hover:bg-[var(--surface)]/95 focus-within:bg-[var(--canvas)] border border-[var(--line)] focus-within:border-[var(--blue)] focus-within:ring-2 focus-within:ring-[var(--focus)] rounded-xl transition-all h-9 px-1 shadow-2xs relative"
              >
                {/* Category Picker Popover Trigger */}
                <div className="relative shrink-0" ref={desktopRef}>
                  <button
                    type="button"
                    onClick={() => setCategoriesOpen((prev) => !prev)}
                    aria-expanded={categoriesOpen}
                    aria-haspopup="true"
                    title={isEn ? 'Filter search by section' : 'Фильтр поиска по разделу'}
                    className="h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--raised)] transition-colors cursor-pointer select-none"
                  >
                    <span>{CATEGORY_ICONS[currentCategory] || '📁'}</span>
                    <span className="max-w-[95px] lg:max-w-[120px] truncate">{getCategoryLabel(currentCategory)}</span>
                    <svg
                      className={`w-3 h-3 text-[var(--muted)] transition-transform duration-200 ${
                        categoriesOpen ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Desktop Dropdown Popover */}
                  {categoriesOpen && renderCategoryDropdownMenu()}
                </div>

                {/* Vertical Divider */}
                <div className="w-[1px] h-4 bg-[var(--line)] my-auto mx-1 shrink-0" />

                {/* Reactive Live Search Input */}
                <div className="flex-1 flex items-center relative min-w-0">
                  <span className="text-[var(--muted)] text-xs pl-1.5 pr-1 shrink-0 select-none">🔍</span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={
                      currentCategory === 'all'
                        ? t('nav.search_placeholder')
                        : isEn
                        ? `Search in ${getCategoryLabel(currentCategory)}...`
                        : `Искать в «${getCategoryLabel(currentCategory)}»...`
                    }
                    maxLength={120}
                    className="w-full bg-transparent text-xs text-[var(--ink)] placeholder-[var(--muted)] outline-none py-1 pr-1 truncate"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => onSearchChange('')}
                      aria-label="Очистить поиск"
                      className="text-[var(--muted)] hover:text-[var(--ink)] text-xs p-1 hover:bg-[var(--raised)] rounded-md cursor-pointer shrink-0 mr-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Actions Bar: Controls, Theme, Lang, Key, Publish */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Thematic Face Switcher (всегда виден) */}
              <FaceSwitcher currentFace={currentFace} onSelectFace={onSelectFace} />

              {/* Location Select (видно на больших экранах >= xl) */}
              <div className="hidden xl:flex items-center gap-1 text-xs text-[var(--muted)] bg-[var(--surface)] border border-[var(--line)] px-2 py-1 rounded-lg h-8">
                <span>📍</span>
                <select
                  aria-label={t('nav.location')}
                  value={selectedLocality}
                  onChange={(e) => onLocalityChange(e.target.value)}
                  className="bg-transparent text-[var(--ink)] font-semibold outline-none cursor-pointer text-xs"
                >
                  <option value="all">{t('nav.all_regions')}</option>
                  <option value="Казань">Казань</option>
                  <option value="Москва">Москва</option>
                  <option value="Санкт-Петербург">Санкт-Петербург</option>
                </select>
              </div>

              {/* Theme & Language (видно на экранах >= lg) */}
              <div className="hidden lg:flex items-center gap-1.5">
                <ThemeToggle />
                <LangToggle />
              </div>

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
                className="bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-bold text-xs h-8 px-2.5 sm:px-3 rounded-lg transition-all cursor-pointer shadow-xs hover:shadow-md flex items-center gap-1 active:scale-98 shrink-0"
              >
                <span className="text-sm font-semibold">＋</span>
                <span className="hidden sm:inline whitespace-nowrap">{t('nav.publish')}</span>
              </button>
            </div>
          </div>

          {/* Mobile Search Row (аккуратно на экранах < md) */}
          <div className="mt-2 md:hidden">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearchSubmit();
              }}
              className="w-full flex items-center bg-[var(--surface)] border border-[var(--line)] focus-within:border-[var(--blue)] rounded-xl h-8 px-1 shadow-2xs relative"
            >
              {/* Category Picker Popover Trigger (Mobile) */}
              <div className="relative shrink-0" ref={mobileRef}>
                <button
                  type="button"
                  onClick={() => setCategoriesOpen((prev) => !prev)}
                  className="h-6 px-1.5 rounded-md flex items-center gap-1 text-[11px] font-semibold text-[var(--ink)] hover:bg-[var(--raised)] cursor-pointer select-none"
                >
                  <span>{CATEGORY_ICONS[currentCategory] || '📁'}</span>
                  <span className="max-w-[70px] truncate">{getCategoryLabel(currentCategory)}</span>
                  <svg
                    className={`w-2.5 h-2.5 text-[var(--muted)] transition-transform duration-200 ${
                      categoriesOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Mobile Dropdown Popover */}
                {categoriesOpen && renderCategoryDropdownMenu()}
              </div>

              <div className="w-[1px] h-3.5 bg-[var(--line)] my-auto mx-1 shrink-0" />

              <span className="text-[var(--muted)] text-[10px] pl-1 pr-1 select-none">🔍</span>

              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t('nav.search_placeholder')}
                className="flex-1 bg-transparent text-xs text-[var(--ink)] placeholder-[var(--muted)] outline-none py-1 px-1 min-w-0"
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
            </form>
          </div>
        </div>
      </header>
    </>
  );
};
