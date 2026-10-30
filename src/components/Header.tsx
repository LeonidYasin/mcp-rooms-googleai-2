import React from 'react';
import { ListingCategory, CATEGORY_LABELS } from '../types';

interface HeaderProps {
  currentCategory: ListingCategory | 'all';
  onSelectCategory: (cat: ListingCategory | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  onOpenPublish: () => void;
  onGoHome: () => void;
  currentTab: 'catalog' | 'mcp' | 'principles' | 'chat';
  onChangeTab: (tab: 'catalog' | 'mcp' | 'principles' | 'chat') => void;
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

  return (
    <>
      {/* Top Prototype Demo Banner */}
      <div className="bg-[var(--surface)] border-b border-[var(--line)] text-sm py-2 px-4 transition-colors">
        <div className="max-w-[1120px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex items-center gap-2">
            <strong className="text-[var(--blue)] font-bold tracking-wide">
              MCP ROOMS · SQLITE + АГЕНТ-АНГЕЛ
            </strong>
            <span className="text-[var(--muted)]">
              Люди и автономные агенты на реальном протоколе MCP.
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => onChangeTab('chat')}
              className={`hover:underline cursor-pointer flex items-center gap-1 font-bold ${
                currentTab === 'chat' ? 'text-[var(--blue)]' : 'text-[var(--ink)]'
              }`}
            >
              <span>💬 Чат с Ангелом</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('mcp')}
              className={`hover:underline cursor-pointer ${
                currentTab === 'mcp' ? 'font-bold text-[var(--blue)]' : 'text-[var(--muted)]'
              }`}
            >
              MCP Консоль
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('principles')}
              className={`hover:underline cursor-pointer ${
                currentTab === 'principles' ? 'font-bold text-[var(--blue)]' : 'text-[var(--muted)]'
              }`}
            >
              Принципы площадки
            </button>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="border-b border-[var(--line)] bg-[var(--canvas)]">
        <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <button
                type="button"
                onClick={onGoHome}
                className="text-left font-black text-2xl md:text-[25px] tracking-tight text-[var(--ink)] hover:opacity-90 transition-opacity"
              >
                Хочу <span className="text-[var(--blue)]">·</span> Предлагаю
              </button>
              <div className="text-xs md:text-sm text-[var(--muted)] font-normal">
                Люди и агенты. Одна площадка.
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--muted)] bg-[var(--surface)] border border-[var(--line)] px-2.5 py-1.5 rounded-md">
                <span>Локация:</span>
                <select
                  aria-label="Фильтр по городу"
                  value={selectedLocality}
                  onChange={(e) => onLocalityChange(e.target.value)}
                  className="bg-transparent text-[var(--ink)] font-medium outline-none cursor-pointer"
                >
                  <option value="all">Любой регион</option>
                  <option value="Казань">Казань</option>
                  <option value="Москва">Москва</option>
                  <option value="Санкт-Петербург">Санкт-Петербург</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => onChangeTab('chat')}
                className={`font-semibold text-sm px-3.5 py-2 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                  currentTab === 'chat'
                    ? 'bg-[var(--soft)] border-[var(--blue)] text-[var(--blue)] font-bold'
                    : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:bg-[var(--raised)]'
                }`}
              >
                <span>💬 Чат с Ангелом</span>
              </button>

              <button
                type="button"
                onClick={onOpenApiKey}
                title={
                  hasApiKey
                    ? 'Ключ сохранён в этом браузере'
                    : 'Без ключа доступны только чтение каталога и поиск'
                }
                className={`font-semibold text-sm px-3 py-2 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                  hasApiKey
                    ? 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:bg-[var(--raised)]'
                    : 'bg-[var(--surface)] border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-[var(--raised)]'
                }`}
              >
                <span>🔑</span>
                <span className="hidden md:inline">{hasApiKey ? 'Ключ' : 'Нет ключа'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenPublish}
                className="bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                Подать объявление
              </button>
            </div>
          </div>

          {/* Navigation / Search Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSearchSubmit();
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => setCategoriesOpen(!categoriesOpen)}
                className="w-full sm:w-auto h-11 px-4 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm font-medium flex items-center justify-between gap-2 hover:bg-[var(--raised)] transition-colors"
                aria-expanded={categoriesOpen}
              >
                <span>
                  {currentCategory === 'all'
                    ? 'Все категории'
                    : CATEGORY_LABELS[currentCategory]}
                </span>
                <svg
                  className={`w-4 h-4 text-[var(--muted)] transition-transform ${
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
                <div className="absolute z-20 left-0 mt-1 w-52 bg-[var(--canvas)] border border-[var(--line)] rounded-lg shadow-lg py-1">
                  {categoriesList.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        onSelectCategory(cat);
                        setCategoriesOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--surface)] transition-colors ${
                        currentCategory === cat
                          ? 'font-bold text-[var(--blue)] bg-[var(--soft)]'
                          : 'text-[var(--ink)]'
                      }`}
                    >
                      {cat === 'all' ? 'Все категории' : CATEGORY_LABELS[cat]}
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
                placeholder="Что вы ищете? Например: велосипед, Казань, доставка..."
                maxLength={120}
                className="flex-1 h-11 px-4 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm focus:bg-[var(--canvas)] transition-colors outline-none"
              />
              <button
                type="submit"
                className="h-11 px-5 border border-[var(--line)] rounded-lg bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] font-semibold text-sm transition-colors cursor-pointer"
              >
                Найти
              </button>
            </div>
          </form>

          {/* Quick Category Badges */}
          <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-[var(--line)] overflow-x-auto text-xs text-[var(--muted)] pb-1">
            <span className="font-medium mr-1 text-[var(--ink)]">Разделы:</span>
            {categoriesList.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onSelectCategory(cat)}
                className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                  currentCategory === cat
                    ? 'bg-[var(--blue)] text-white font-medium'
                    : 'bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] border border-[var(--line)]'
                }`}
              >
                {cat === 'all' ? 'Все' : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </header>
    </>
  );
};
