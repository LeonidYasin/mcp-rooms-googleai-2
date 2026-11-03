import React from 'react';
import { useI18n } from '../i18n';

interface LangToggleProps {
  className?: string;
}

export const LangToggle: React.FC<LangToggleProps> = ({ className = '' }) => {
  const { locale, toggleLocale, t } = useI18n();

  return (
    <button
      type="button"
      onClick={toggleLocale}
      title={t('lang.toggle')}
      aria-label={t('lang.toggle')}
      className={`h-7 px-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer select-none ${className}`}
    >
      <span className="text-xs">🌐</span>
      <span className="uppercase tracking-wider font-extrabold text-[11px]">
        {locale === 'ru' ? 'RU' : 'EN'}
      </span>
    </button>
  );
};
