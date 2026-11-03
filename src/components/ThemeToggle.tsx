import React from 'react';
import { useI18n, ThemeMode } from '../i18n';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { theme, setTheme, resolvedTheme, t } = useI18n();

  const cycleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  const getIcon = () => {
    if (theme === 'system') {
      return <span>💻</span>;
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
      className={`h-7 px-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer select-none ${className}`}
    >
      {getIcon()}
      {showLabel && (
        <span className="capitalize text-[11px]">
          {theme === 'system' ? t('theme.system') : getLabel()}
        </span>
      )}
    </button>
  );
};
