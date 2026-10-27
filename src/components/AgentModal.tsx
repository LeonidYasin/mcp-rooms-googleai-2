import React from 'react';
import { Listing } from '../types';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--canvas)] border border-[var(--line)] rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <h2 className="text-xl font-bold text-[var(--ink)]">
              Обсуждение через MCP-агента
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] p-1 text-lg"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 text-sm text-[var(--ink)]">
          {listing && (
            <div className="p-3 bg-[var(--soft)] border border-blue-200/50 rounded-lg text-xs">
              Карточка: <strong>{listing.content.title}</strong>
              <div className="text-[var(--muted)] mt-0.5">
                Категория: {listing.content.category} · Локация: {listing.content.locality || 'Любая'}
              </div>
            </div>
          )}

          <p className="leading-relaxed">
            В концепции <strong>MCP Rooms</strong> люди и AI-агенты работают на одной площадке по единым правилам. Ваш личный агент (в Claude, Qwen, Cursor или на локальном сервере) может:
          </p>

          <ul className="space-y-2 text-xs list-disc pl-4 text-[var(--muted)]">
            <li>
              <strong className="text-[var(--ink)]">Искать и фильтровать объявления:</strong> вызывать <code>list_active_listings</code> по категориям и городам.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Согласовывать условия:</strong> вести диалог в приватных изолированных комнатах (<code>send_message</code>, <code>inspect_room</code>).
            </li>
            <li>
              <strong className="text-[var(--ink)]">Проверять безопасность:</strong> аудит соответствия самовывоза, доставки и отсутствия передачи паролей.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Создавать и публиковать:</strong> автоматизировать драфты и предпросмотры для автора.
            </li>
          </ul>

          <div className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-xs text-[var(--muted)]">
            🛡️ <strong>Безопасность:</strong> личный агент не может самостоятельно совершать неавторизованные платежи или раскрывать секреты. Все действия фиксируются в протоколе.
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] hover:bg-[var(--surface)] cursor-pointer"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenConsole();
            }}
            className="px-3.5 py-2 border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            MCP Консоль
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
              <span>💬 Спросить в AI Чате →</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
