import React from 'react';
import { ListingCategory } from '../types';
import { useI18n, TranslationKey } from '../i18n';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { LangToggle } from './LangToggle';

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
}) => {
  const { t } = useI18n();
  const [categoriesOpen, setCategoriesOpen] = React.useState(false);

  const categoriesList: Array<ListingCategory | 'all'> = [
    'all',
    'business',
    'jobs',
    'services',
    'real_estate',
    'communities',
    'things',
    'dating',
    'rides',
    'delivery',
    'other',
  ];

  const getCategoryLabel = (cat: ListingCategory | 'all'): string => {
    return t(`cat.${cat}` as TranslationKey);
  };

  return (
    <>
      {/* Top Prototype Demo Banner */}
      <div className="bg-[var(--surface)] border-b border-[var(--line)] text-sm py-2 px-4 transition-colors">
        <div className="max-w-[1120px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex items-center gap-2">
            <strong className="text-[var(--blue)] font-bold tracking-wide text-[11px] md:text-xs">
              {t('site.badge')}
            </strong>
            <span className="text-[var(--muted)] text-[11px] md:text-xs hidden sm:inline">
              {t('site.badge_sub')}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 text-xs">
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
          </div>
        </div>
      </div>

      {/* Main Header with Sticky Glassmorphism */}
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--canvas)]/90 backdrop-blur-md transition-colors">
        <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-3.5 md:py-4">
          <div className="flex items-center justify-between gap-3 mb-3.5">
            {/* Logo and Home Button */}
            <button
              type="button"
              onClick={onGoHome}
              className="text-left cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
              title={t('site.title')}
            >
              <Logo
                size="md"
                title={t('site.title')}
                subtitle={t('site.subtitle')}
              />
            </button>

            {/* Actions Bar: Controls, Theme, Lang, Key, Publish */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Location Select (hidden on small mobile) */}
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-[var(--muted)] bg-[var(--surface)] border border-[var(--line)] px-2.5 py-1.5 rounded-lg h-9">
                <span>{t('nav.location')}</span>
                <select
                  aria-label={t('nav.location')}
                  value={selectedLocality}
                  onChange={(e) => onLocalityChange(e.target.value)}
                  className="bg-transparent text-[var(--ink)] font-semibold outline-none cursor-pointer"
                >
                  <option value="all">{t('nav.all_regions')}</option>
                  <option value="Казань">Казань</option>
                  <option value="Москва">Москва</option>
                  <option value="Санкт-Петербург">Санкт-Петербург</option>
                </select>
              </div>

              {/* Theme Switcher */}
              <ThemeToggle />

              {/* Language Switcher */}
              <LangToggle />

              {/* Key Status Button */}
              <button
                type="button"
                onClick={onOpenApiKey}
                title={hasApiKey ? t('nav.key_saved') : t('nav.key_needed')}
                className={`font-semibold text-xs sm:text-sm h-9 px-2.5 sm:px-3 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                  hasApiKey
                    ? 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:bg-[var(--raised)]'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60'
                }`}
              >
                <span>🔑</span>
                <span className="hidden sm:inline">{hasApiKey ? t('nav.key') : t('nav.no_key')}</span>
              </button>

              {/* Publish Action Button */}
              <button
                type="button"
                onClick={onOpenPublish}
                className="bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-bold text-xs sm:text-sm h-9 px-3 sm:px-4 rounded-lg transition-all cursor-pointer shadow-xs hover:shadow-md flex items-center gap-1.5 active:scale-98"
              >
                <span className="text-sm font-normal">＋</span>
                <span className="whitespace-nowrap">{t('nav.publish')}</span>
              </button>
            </div>
          </div>

          {/* Search Row */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSearchSubmit();
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => setCategoriesOpen(!categoriesOpen)}
                className="w-full sm:w-auto h-10 px-3.5 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 hover:bg-[var(--raised)] transition-colors cursor-pointer"
                aria-expanded={categoriesOpen}
              >
                <span>{getCategoryLabel(currentCategory)}</span>
                <svg
                  className={`w-3.5 h-3.5 text-[var(--muted)] transition-transform ${
                    categoriesOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {categoriesOpen && (
                <div className="absolute z-40 left-0 mt-1 w-56 bg-[var(--canvas)] border border-[var(--line)] rounded-xl shadow-2xl py-1.5 animate-in fade-in duration-150">
                  {categoriesList.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        onSelectCategory(cat);
                        setCategoriesOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm hover:bg-[var(--surface)] transition-colors cursor-pointer ${
                        currentCategory === cat
                          ? 'font-bold text-[var(--blue)] bg-[var(--soft)]'
                          : 'text-[var(--ink)]'
                      }`}
                    >
                      {getCategoryLabel(cat)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 flex gap-2">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t('nav.search_placeholder')}
                maxLength={120}
                className="flex-1 h-10 px-3.5 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-xs sm:text-sm focus:bg-[var(--canvas)] transition-colors outline-none"
              />
              <button
                type="submit"
                className="h-10 px-4 sm:px-5 border border-[var(--line)] rounded-lg bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] font-bold text-xs sm:text-sm transition-colors cursor-pointer shrink-0"
              >
                {t('nav.search_btn')}
              </button>
            </div>
          </form>

          {/* Quick Category Badges */}
          <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-[var(--line)] overflow-x-auto text-xs text-[var(--muted)] pb-0.5 no-scrollbar">
            <span className="font-semibold mr-1 text-[var(--ink)] shrink-0">{t('nav.sections')}</span>
            {categoriesList.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onSelectCategory(cat)}
                className={`px-3 py-1 rounded-full whitespace-nowrap transition-all cursor-pointer text-[11px] sm:text-xs font-medium ${
                  currentCategory === cat
                    ? 'bg-[var(--blue)] text-white font-bold shadow-xs'
                    : 'bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] border border-[var(--line)]'
                }`}
              >
                {getCategoryLabel(cat)}
              </button>
            ))}
          </div>
        </div>
      </header>
    </>
  );
};
