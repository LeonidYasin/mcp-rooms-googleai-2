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
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  currentCategory,
  onSelectCategory,
  accentColor,
}) => {
  const { t } = useI18n();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 240;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const getCategoryLabel = (cat: ListingCategory | 'all'): string => {
    return t(`cat.${cat}` as TranslationKey);
  };

  return (
    <div className="relative mb-6 group">
      {/* Scroll Left Button */}
      <button
        type="button"
        onClick={() => handleScroll('left')}
        aria-label="Scroll categories left"
        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-[var(--surface)] border border-[var(--line)] shadow-md items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:scale-105 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
      >
        ‹
      </button>

      {/* Horizontal Carousel Container */}
      <div
        ref={scrollContainerRef}
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
        aria-label="Scroll categories right"
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-[var(--surface)] border border-[var(--line)] shadow-md items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:scale-105 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
      >
        ›
      </button>
    </div>
  );
};
