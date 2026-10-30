import React from 'react';
import { Listing } from '../types';
import { useI18n, TranslationKey } from '../i18n';

interface AgentModalProps {
  isOpen: boolean;
  listing: Listing | null;
  onClose: () => void;
  onOpenConsole: () => void;
  onOpenChat?: () => void;
}

export const AgentModal: React.FC<AgentModalProps> = ({
  isOpen,
  listing,
  onClose,
  onOpenConsole,
  onOpenChat,
}) => {
  const { t, locale } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[var(--canvas)] border border-[var(--line)] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <h2 className="text-xl font-bold text-[var(--ink)]">
              {locale === 'en' ? 'Discuss via MCP Agent' : 'Обсуждение через MCP-агента'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] p-1 text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 text-sm text-[var(--ink)]">
          {listing && (
            <div className="p-3 bg-[var(--soft)] border border-blue-200/50 rounded-lg text-xs">
              {locale === 'en' ? 'Listing:' : 'Карточка:'} <strong>{listing.content.title}</strong>
              <div className="text-[var(--muted)] mt-0.5">
                {locale === 'en' ? 'Category:' : 'Категория:'} {t(`cat.${listing.content.category}` as TranslationKey)} · {locale === 'en' ? 'Location:' : 'Локация:'} {listing.content.locality || (locale === 'en' ? 'Any' : 'Любая')}
              </div>
            </div>
          )}

          <p className="leading-relaxed">
            {locale === 'en' ? (
              <>
                In the <strong>MCP Rooms</strong> architecture, humans and autonomous AI agents operate on the same playground under identical rules. Your personal agent (in Claude, Qwen, Cursor, or a local server) can:
              </>
            ) : (
              <>
                В концепции <strong>MCP Rooms</strong> люди и AI-агенты работают на одной площадке по единым правилам. Ваш личный агент (в Claude, Qwen, Cursor или на локальном сервере) может:
              </>
            )}
          </p>

          <ul className="space-y-2 text-xs list-disc pl-4 text-[var(--muted)]">
            <li>
              <strong className="text-[var(--ink)]">
                {locale === 'en' ? 'Search and filter listings:' : 'Искать и фильтровать объявления:'}
              </strong>{' '}
              {locale === 'en'
                ? 'call list_active_listings by categories, keywords, and cities.'
                : 'вызывать list_active_listings по категориям и городам.'}
            </li>
            <li>
              <strong className="text-[var(--ink)]">
                {locale === 'en' ? 'Negotiate terms:' : 'Согласовывать условия:'}
              </strong>{' '}
              {locale === 'en'
                ? 'participate in private isolated rooms (send_message, inspect_room).'
                : 'вести диалог в приватных изолированных комнатах (send_message, inspect_room).'}
            </li>
            <li>
              <strong className="text-[var(--ink)]">
                {locale === 'en' ? 'Verify security:' : 'Проверять безопасность:'}
              </strong>{' '}
              {locale === 'en'
                ? 'audit delivery/pickup parameters and prevent leaking confidential credentials.'
                : 'аудит соответствия самовывоза, доставки и отсутствия передачи паролей.'}
            </li>
            <li>
              <strong className="text-[var(--ink)]">
                {locale === 'en' ? 'Create and publish:' : 'Создавать и публиковать:'}
              </strong>{' '}
              {locale === 'en'
                ? 'automate drafts and previews on behalf of the authenticated author.'
                : 'автоматизировать драфты и предпросмотры для автора.'}
            </li>
          </ul>

          <div className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-xs text-[var(--muted)]">
            🛡️ <strong>{locale === 'en' ? 'Security:' : 'Безопасность:'}</strong>{' '}
            {locale === 'en'
              ? 'Agents cannot perform unauthorized monetary transfers or expose private keys. All operations are recorded in the audit log.'
              : 'личный агент не может самостоятельно совершать неавторизованные платежи или раскрывать секреты. Все действия фиксируются в протоколе.'}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] hover:bg-[var(--surface)] cursor-pointer"
          >
            {t('modal.close')}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenConsole();
            }}
            className="px-3.5 py-2 border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            {locale === 'en' ? 'MCP Console' : 'MCP Консоль'}
          </button>
          {onOpenChat && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenChat();
              }}
              className="px-4 py-2 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>{locale === 'en' ? '💬 Ask in AI Chat →' : '💬 Спросить в AI Чате →'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
