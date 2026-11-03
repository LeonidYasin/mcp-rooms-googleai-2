import React from 'react';
import { Listing } from '../types';
import { useI18n, TranslationKey } from '../i18n';

interface ListingCardProps {
  listing: Listing;
  onOpen: (listing: Listing) => void;
  onDelegateToAngel?: (listing: Listing) => void;
  variant?: 'default' | 'metric';
}

export const formatPrice = (
  priceMinor: number | null,
  currency: string = 'RUB',
  agreementText: string = 'Цена по договорённости'
): string => {
  if (priceMinor === null || priceMinor === undefined) {
    return agreementText;
  }
  const rubles = Math.floor(priceMinor / 100);
  const formatted = rubles.toLocaleString();
  const currencySymbol = currency === 'RUB' ? '₽' : currency;
  return `${formatted} ${currencySymbol}`;
};

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  onOpen,
  onDelegateToAngel,
  variant = 'default',
}) => {
  const { t, locale } = useI18n();
  const { content, photos, responses_count, author_name, profile, similarity_score } = listing;

  const kindLabel = content.kind === 'offer' ? t('kind.offer') : t('kind.request');
  const catLabel = t(`cat.${content.category}` as TranslationKey);
  const modesText = content.modes
    .map((m) => t(`mode.${m}` as TranslationKey))
    .join(locale === 'en' ? ' or ' : ' или ');
  const locationText = [content.locality, modesText].filter(Boolean).join(' · ');
  const isAgent = Boolean(author_name?.startsWith('agent:') || author_name?.toLowerCase().includes('agent'));

  // 💎 V2 Mockup Dark Metric Card Variant (3-Column Grid with STRICTLY REAL DATA)
  if (variant === 'metric') {
    return (
      <article className="glass-card rounded-2xl p-5 md:p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 group relative">
        <div>
          {/* Top Row: Honest Status Badge + Kind Badge */}
          <div className="flex items-center justify-between gap-2 mb-3">
            {isAgent ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live AI Agent</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-white/10">
                <span>👤 {author_name || (locale === 'en' ? 'User' : 'Пользователь')}</span>
              </div>
            )}
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-white/5">
              {kindLabel}
            </span>
          </div>

          {/* Title */}
          <h2
            onClick={() => onOpen(listing)}
            className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors mb-2 leading-snug cursor-pointer line-clamp-1"
          >
            {content.title}
          </h2>

          {/* Description */}
          <p className="text-xs text-slate-400 line-clamp-2 mb-3.5 leading-relaxed">
            {content.description}
          </p>

          {/* 4-Row Metrics Grid (Strictly REAL factual data from SQLite record) */}
          <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5 space-y-2 mb-3.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{locale === 'en' ? 'Author Type:' : 'Тип автора:'}</span>
              <span className={isAgent ? 'font-semibold text-emerald-400' : 'font-medium text-slate-300'}>
                {isAgent ? '● Автономный агент' : '👤 Автор-человек'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{locale === 'en' ? 'Locality & Mode:' : 'Локация и формат:'}</span>
              <span className="font-semibold text-slate-200 truncate max-w-[150px]">{locationText || t('card.location_any')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{locale === 'en' ? 'Active Rooms:' : 'Комнат сделки:'}</span>
              <span className="font-semibold text-cyan-400">
                {responses_count > 0 ? `${responses_count}` : (locale === 'en' ? '0 active' : 'Ожидает откликов')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{locale === 'en' ? 'Profile Status:' : 'Статус профиля:'}</span>
              <span className={profile?.verified ? 'font-semibold text-emerald-400' : 'text-slate-400'}>
                {profile?.verified ? '✓ Верифицирован' : (locale === 'en' ? 'Open Profile' : 'Открытый профиль')}
              </span>
            </div>
          </div>

          {/* Tag Chips (Real tags only) */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-800/80 text-slate-300 border border-white/5">
              {catLabel}
            </span>
            {content.modes.map((m) => (
              <span key={m} className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-800/60 text-slate-400 border border-white/5">
                {m}
              </span>
            ))}
            {isAgent && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-500/20">
                MCP Agent
              </span>
            )}
          </div>
        </div>

        {/* Card Bottom: Price & CTA */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3 mt-auto">
          <div className="text-xl font-black text-white tracking-tight">
            {formatPrice(content.price_minor, content.currency, t('card.free'))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpen(listing)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/15"
            >
              {locale === 'en' ? 'Enter Room →' : 'В комнату →'}
            </button>
            {onDelegateToAngel && (
              <button
                type="button"
                onClick={() => onDelegateToAngel(listing)}
                className="p-1.5 rounded-xl text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors cursor-pointer"
                title={locale === 'en' ? 'Delegate to Angel Agent' : 'Поручить Ангелу'}
              >
                👼
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="glass-card rounded-2xl p-5 md:p-6 flex flex-col md:flex-row justify-between gap-5 items-start md:items-center shadow-xs group">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              content.kind === 'offer'
                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800'
                : 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800'
            }`}
          >
            {kindLabel} · {catLabel}
          </span>
          {content.subcategory && (
            <span className="text-xs text-[var(--muted)]">
              → {content.subcategory}
            </span>
          )}
          {similarity_score !== undefined && (
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full">
              {Math.round(similarity_score * 100)}% {locale === 'en' ? 'match' : 'совпадение'}
            </span>
          )}
          {responses_count > 0 && (
            <span className="text-xs text-[var(--blue)] bg-[var(--soft)] px-2 py-0.5 rounded-full font-medium">
              {locale === 'en' ? 'Rooms:' : 'Откликов:'} {responses_count}
            </span>
          )}
        </div>

        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--ink)] mb-1 leading-snug group-hover:text-[var(--blue)] transition-colors">
          {content.title}
        </h2>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)] mb-2">
          <span className="font-semibold text-[var(--ink)]">{author_name}</span>
          {profile?.verified && (
            <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded font-semibold text-[10px]">
              ✓ {locale === 'en' ? 'Verified' : 'Верифицирован'}
            </span>
          )}
          {profile?.type === 'company' && (
            <span className="bg-[var(--soft)] text-[var(--blue)] px-1.5 py-0.5 rounded text-[10px] font-medium">
              {locale === 'en' ? 'Company' : 'Компания'}
            </span>
          )}
          {profile?.reputation_score && (
            <span>★ {profile.reputation_score.toFixed(1)}</span>
          )}
          <span>·</span>
          <span>{locationText || t('card.location_any')}</span>
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
            <span>{locale === 'en' ? 'View Card' : 'Карточка'}</span>
            <svg className="w-3.5 h-3.5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {onDelegateToAngel && (
            <button
              type="button"
              onClick={() => onDelegateToAngel(listing)}
              className="h-9 px-3.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-[var(--soft)] hover:bg-blue-100 dark:hover:bg-blue-900/40 text-[var(--blue)] font-semibold text-sm transition-colors cursor-pointer inline-flex items-center gap-1.5"
              title={
                locale === 'en'
                  ? 'Delegate autonomous peer-to-peer negotiation to Angel Agent'
                  : 'Поручить персональному Агенту-Ангелу провести автономные переговоры'
              }
            >
              <span>👼 {locale === 'en' ? 'Delegate to Angel' : 'Поручить Ангелу'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="md:text-right shrink-0 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-[var(--line)] flex md:flex-col justify-between items-center md:items-end">
        <div className="text-2xl md:text-[27px] font-black text-[var(--ink)] tracking-tight">
          {formatPrice(content.price_minor, content.currency, t('card.free'))}
        </div>
        {photos && photos.length > 0 ? (
          <div className="mt-2 text-xs text-[var(--muted)] flex items-center gap-1 bg-[var(--surface)] px-2 py-0.5 rounded-md border border-[var(--line)]">
            <span>📷 {locale === 'en' ? 'Photos:' : 'Фото:'} {photos.length}</span>
          </div>
        ) : isAgent ? (
          <div className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{locale === 'en' ? 'Live MCP Agent' : 'Автономный AI-агент'}</span>
          </div>
        ) : (
          <div className="mt-2 text-[11px] font-medium text-[var(--muted)] flex items-center gap-1 bg-[var(--surface)] px-2 py-0.5 rounded-md border border-[var(--line)]">
            <span>⚡ {locale === 'en' ? 'Fast Response' : 'Быстрый отклик'}</span>
          </div>
        )}
      </div>
    </article>
  );
};
