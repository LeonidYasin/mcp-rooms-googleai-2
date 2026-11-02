import React, { useEffect } from 'react';
import { useI18n } from '../i18n';
import { Logo } from './Logo';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenConnect: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose, onOpenConnect }) => {
  const { t } = useI18n();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--canvas)] border border-[var(--line)] rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl my-auto max-h-[92vh] overflow-y-auto space-y-6">
        {/* Header with Logo and Close */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <Logo size="sm" />
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider bg-[var(--soft)] text-[var(--blue)] border border-blue-200 dark:border-blue-800 uppercase">
                {t('about.badge')}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--ink)] tracking-tight">
              {t('about.modal_title')}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
              {t('about.tagline')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('about.close_btn')}
            className="text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] p-1.5 rounded-lg transition-colors cursor-pointer text-base shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Overview Box */}
        <div className="p-4 sm:p-5 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2">
          <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
            <span>🌐</span>
            <span>{t('about.what_title')}</span>
          </h3>
          <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
            {t('about.what_desc')}
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--canvas)] space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-base">🔍</span>
              <h4 className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                {t('about.pillar1_title')}
              </h4>
            </div>
            <p className="text-[11px] sm:text-xs text-[var(--muted)] leading-relaxed">
              {t('about.pillar1_desc')}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--canvas)] space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-base">🔒</span>
              <h4 className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                {t('about.pillar2_title')}
              </h4>
            </div>
            <p className="text-[11px] sm:text-xs text-[var(--muted)] leading-relaxed">
              {t('about.pillar2_desc')}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--canvas)] space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <h4 className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                {t('about.pillar3_title')}
              </h4>
            </div>
            <p className="text-[11px] sm:text-xs text-[var(--muted)] leading-relaxed">
              {t('about.pillar3_desc')}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--canvas)] space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-base">🤝</span>
              <h4 className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                {t('about.pillar4_title')}
              </h4>
            </div>
            <p className="text-[11px] sm:text-xs text-[var(--muted)] leading-relaxed">
              {t('about.pillar4_desc')}
            </p>
          </div>
        </div>

        {/* Tech Stack Pills */}
        <div className="pt-2 border-t border-[var(--line)] space-y-2">
          <div className="text-xs font-bold text-[var(--ink)]">
            {t('about.stack_title')}
          </div>
          <p className="text-[11px] sm:text-xs text-[var(--muted)] leading-relaxed">
            {t('about.stack_desc')}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {['React 19', 'TypeScript', 'Vite 6', 'Tailwind v4', 'Express 5', 'SQLite', 'MCP JSON-RPC', 'SSE'].map((tech) => (
              <span
                key={tech}
                className="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-medium bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)]"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--line)]">
          <a
            href="https://github.com/LeonidYasin/mcp-rooms-googleai-2"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[var(--ink)] hover:text-[var(--blue)] transition-colors"
          >
            <span>🐙 {t('about.github_btn')} ↗</span>
          </a>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenConnect();
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white transition-all cursor-pointer shadow-xs"
            >
              🔌 {t('about.connect_btn')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-[var(--surface)] hover:bg-[var(--raised)] border border-[var(--line)] text-[var(--ink)] transition-colors cursor-pointer"
            >
              {t('about.close_btn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
