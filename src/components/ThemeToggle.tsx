import React from 'react';
import { useI18n, ThemeMode } from '../i18n';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, setTheme, resolvedTheme, t } = useI18n();

  const cycleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  const getIcon = () => {
    if (theme === 'system') {
      return (
        <span className="flex items-center gap-1">
          <span className="text-xs">💻</span>
          <span className="hidden xl:inline text-[11px] font-medium text-[var(--muted)]">
            {resolvedTheme === 'dark' ? '🌙' : '☀️'}
          </span>
        </span>
      );
    }
    return theme === 'dark' ? <span>🌙</span> : <span>☀️</span>;
  };

  const getLabel = () => {
    if (theme === 'system') return `${t('theme.system')} (${resolvedTheme === 'dark' ? t('theme.dark') : t('theme.light')})`;
    if (theme === 'dark') return t('theme.dark');
    return t('theme.light');
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={`${t('theme.toggle')}: ${getLabel()}`}
      aria-label={`${t('theme.toggle')}: ${getLabel()}`}
      className={`h-9 px-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer select-none ${className}`}
    >
      {getIcon()}
      <span className="hidden lg:inline capitalize">
        {theme === 'system' ? t('theme.system') : getLabel()}
      </span>
    </button>
  );
};
