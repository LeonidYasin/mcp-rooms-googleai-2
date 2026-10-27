import React from 'react';
import { Listing, CATEGORY_LABELS, MODE_LABELS } from '../types';

interface ListingCardProps {
  listing: Listing;
  onOpen: (listing: Listing) => void;
  onDelegateToAngel?: (listing: Listing) => void;
}

export const formatPrice = (priceMinor: number | null, currency: string = 'RUB'): string => {
  if (priceMinor === null || priceMinor === undefined) {
    return 'Цена по договорённости';
  }
  const rubles = Math.floor(priceMinor / 100);
  const formatted = rubles.toLocaleString('ru-RU');
  const currencySymbol = currency === 'RUB' ? '₽' : currency;
  return `${formatted} ${currencySymbol}`;
};

export const ListingCard: React.FC<ListingCardProps> = ({ listing, onOpen, onDelegateToAngel }) => {
  const { content, photos, responses_count, author_name, profile, similarity_score } = listing;

  const modesText = content.modes.map((m) => MODE_LABELS[m]).join(' или ');
  const locationText = [content.locality, modesText].filter(Boolean).join(' · ');

  return (
    <article className="border border-[var(--line)] rounded-xl p-5 md:p-6 bg-[var(--canvas)] hover:border-[var(--blue)] transition-all flex flex-col md:flex-row justify-between gap-5 items-start md:items-center shadow-xs">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-[var(--green)] bg-[var(--greenbg)] px-2.5 py-0.5 rounded">
            {content.kind === 'offer' ? 'Предлагаю' : 'Хочу'} · {CATEGORY_LABELS[content.category]}
          </span>
          {content.subcategory && (
            <span className="text-xs text-[var(--muted)]">
              → {content.subcategory}
            </span>
          )}
          {similarity_score !== undefined && (
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded">
              {Math.round(similarity_score * 100)}% совпадение
            </span>
          )}
          {responses_count > 0 && (
            <span className="text-xs text-[var(--blue)] bg-[var(--soft)] px-2 py-0.5 rounded font-medium">
              Откликов: {responses_count}
            </span>
          )}
        </div>

        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--ink)] mb-1 leading-snug">
          {content.title}
        </h2>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)] mb-2">
          <span className="font-medium text-[var(--ink)]">{author_name}</span>
          {profile?.verified && (
            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold text-[10px]">
              ✓ Верифицирован
            </span>
          )}
          {profile?.type === 'company' && (
            <span className="bg-[var(--soft)] text-[var(--blue)] px-1.5 py-0.2 rounded text-[10px] font-medium">
              Компания
            </span>
          )}
          {profile?.reputation_score && (
            <span>★ {profile.reputation_score.toFixed(1)}</span>
          )}
          <span>·</span>
          <span>{locationText || 'Локация не указана'}</span>
        </div>

        <p className="text-sm text-[var(--muted)] line-clamp-2 mb-4 leading-relaxed">
          {content.description}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(listing)}
            className="h-9 px-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] font-semibold text-sm transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>Карточка</span>
            <svg className="w-3.5 h-3.5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {onDelegateToAngel && (
            <button
              type="button"
              onClick={() => onDelegateToAngel(listing)}
              className="h-9 px-3.5 rounded-lg border border-blue-200 bg-[var(--soft)] hover:bg-blue-100 text-[var(--blue)] font-semibold text-sm transition-colors cursor-pointer inline-flex items-center gap-1.5"
              title="Поручить персональному Агенту-Ангелу провести автономные переговоры"
            >
              <span>👼 Поручить Ангелу</span>
            </button>
          )}
        </div>
      </div>

      <div className="md:text-right shrink-0 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-[var(--line)] flex md:flex-col justify-between items-center md:items-end">
        <div className="text-2xl md:text-[28px] font-black text-[var(--ink)] tracking-tight">
          {formatPrice(content.price_minor, content.currency)}
        </div>
        {photos && photos.length > 0 ? (
          <div className="mt-2 text-xs text-[var(--muted)] flex items-center gap-1">
            <span>📷 Фото: {photos.length}</span>
          </div>
        ) : (
          <div className="text-xs text-[var(--muted)] mt-1">
            Без фото
          </div>
        )}
      </div>
    </article>
  );
};
