import React, { useRef } from 'react';
import { ListingCategory } from '../types';
import { useI18n, TranslationKey } from '../i18n';

export const CATEGORY_ICONS: Record<ListingCategory | 'all', string> = {
  all: '🌐',
  business: '💼',
  jobs: '👔',
  services: '🛠️',
  real_estate: '🏢',
  communities: '👥',
  things: '📦',
  dating: '❤️',
  rides: '🚕',
  delivery: '🚚',
  other: '✨',
};

export const CATEGORIES_ORDER: Array<ListingCategory | 'all'> = [
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

interface CategoryBarProps {
  currentCategory: ListingCategory | 'all';
  onSelectCategory: (cat: ListingCategory | 'all') => void;
  accentColor?: string;
  isFloatingDock?: boolean;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  currentCategory,
  onSelectCategory,
  accentColor,
  isFloatingDock = false,
}) => {
  const { t, locale } = useI18n();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      setCanScrollLeft(scrollContainerRef.current.scrollLeft > 10);
    }
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 240;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScroll, 200);
    }
  };

  const getCategoryLabel = (cat: ListingCategory | 'all'): string => {
    return t(`cat.${cat}` as TranslationKey);
  };

  // 💎 V2 Mockup Centered Floating Glass Pill Dock
  if (isFloatingDock) {
    return (
      <div className="flex justify-center mb-8 px-2">
        <div
          role="tablist"
          aria-label={t('nav.sections')}
          className="floating-glass-dock inline-flex items-center gap-1.5 p-1.5 rounded-2xl max-w-full overflow-x-auto no-scrollbar"
        >
          {CATEGORIES_ORDER.map((cat) => {
            const isSelected = currentCategory === cat;
            const label = getCategoryLabel(cat);
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => onSelectCategory(cat)}
                title={
                  cat === 'all'
                    ? (locale === 'en' ? 'Show all listings across all categories' : 'Показать все объявления без ограничений по категориям')
                    : (locale === 'en' ? `Filter by category: ${label}` : `Фильтровать объявления по разделу «${label}»`)
                }
                className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap select-none ${
                  isSelected
                    ? 'bg-slate-800/90 text-white font-semibold shadow-inner border border-white/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <span>{cat === 'all' ? (locale === 'en' ? 'All Rooms' : 'Все комнаты') : label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-6 group">
      {/* Scroll Left Button (только когда есть скролл влево, чтобы не перекрывать первый раздел) */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScroll('left')}
          title={locale === 'en' ? 'Scroll categories left' : 'Прокрутить разделы влево'}
          aria-label={locale === 'en' ? 'Scroll categories left' : 'Прокрутить разделы влево'}
          className="hidden md:flex absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-[var(--surface)] border border-[var(--line)] shadow-md items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:scale-105 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
        >
          ‹
        </button>
      )}

      {/* Horizontal Carousel Container */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        role="tablist"
        aria-label={t('nav.sections')}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 -mx-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {CATEGORIES_ORDER.map((cat) => {
          const isSelected = currentCategory === cat;
          const icon = CATEGORY_ICONS[cat];
          const label = getCategoryLabel(cat);

          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelectCategory(cat)}
              title={
                cat === 'all'
                  ? (locale === 'en' ? 'Show all listings across all categories' : 'Показать все объявления без ограничений по категориям')
                  : (locale === 'en' ? `Filter by category: ${label}` : `Фильтровать объявления по разделу «${label}»`)
              }
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 select-none border ${
                isSelected
                  ? 'bg-[var(--blue)] text-white border-transparent shadow-xs font-bold scale-[1.02]'
                  : 'bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--muted)]/40'
              }`}
              style={{
                backgroundColor: isSelected && accentColor ? accentColor : undefined,
              }}
            >
              <span className="text-base leading-none">{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      <button
        type="button"
        onClick={() => handleScroll('right')}
        title={locale === 'en' ? 'Scroll categories right' : 'Прокрутить разделы вправо'}
        aria-label={locale === 'en' ? 'Scroll categories right' : 'Прокрутить разделы вправо'}
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-[var(--surface)] border border-[var(--line)] shadow-md items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:scale-105 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
      >
        ›
      </button>
    </div>
  );
};
