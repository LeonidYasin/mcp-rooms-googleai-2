import React, { useState } from 'react';
import { Listing } from '../types';

interface ContactModalProps {
  isOpen: boolean;
  listing: Listing | null;
  onClose: () => void;
  onSendMessage: (
    listingId: string,
    messageText: string,
    contactInfo: string,
    visibility?: 'public' | 'private'
  ) => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  listing,
  onClose,
  onSendMessage,
}) => {
  const [message, setMessage] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen || !listing) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSendMessage(listing.id, message, contactInfo, visibility);
    setSentSuccess(true);
    setTimeout(() => {
      setSentSuccess(false);
      setMessage('');
      setContactInfo('');
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--canvas)] border border-[var(--line)] rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--ink)]">
              Связь с продавцом
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              По объявлению: <strong>{listing.content.title}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] p-1 text-lg"
          >
            ✕
          </button>
        </div>

        {sentSuccess ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ✓
            </div>
            <h3 className="text-lg font-bold text-[var(--ink)]">
              Отклик отправлен в защищённую комнату
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Продавец получит уведомление в MCP-комнате. Ваши личные данные не разглашаются в публичной ленте.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1.5">
                Формат общения
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`p-3 border rounded-xl cursor-pointer flex flex-col gap-1 transition-colors ${
                    visibility === 'private'
                      ? 'border-[var(--blue)] bg-blue-50/40 dark:bg-blue-950/20'
                      : 'border-[var(--line)] bg-[var(--surface)]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink)]">
                    <input
                      type="radio"
                      name="modal_visibility"
                      value="private"
                      checked={visibility === 'private'}
                      onChange={() => setVisibility('private')}
                    />
                    <span>🔒 Приватная</span>
                  </div>
                  <span className="text-[11px] text-[var(--muted)] leading-tight">
                    Конфиденциально 1-на-1 с автором
                  </span>
                </label>

                <label
                  className={`p-3 border rounded-xl cursor-pointer flex flex-col gap-1 transition-colors ${
                    visibility === 'public'
                      ? 'border-[var(--blue)] bg-blue-50/40 dark:bg-blue-950/20'
                      : 'border-[var(--line)] bg-[var(--surface)]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink)]">
                    <input
                      type="radio"
                      name="modal_visibility"
                      value="public"
                      checked={visibility === 'public'}
                      onChange={() => setVisibility('public')}
                    />
                    <span>🌐 Открытая тема</span>
                  </div>
                  <span className="text-[11px] text-[var(--muted)] leading-tight">
                    Видна всем в общем каталоге тем
                  </span>
                </label>
              </div>
            </div>

            <div className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-xs text-[var(--muted)]">
              🔒 <strong>Принцип безопасности:</strong> телефон и точный адрес не публикуются автоматически. Общение начинается в защищённой комнате протокола MCP.
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">
                Ваше сообщение
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Здравствуйте! Хочу уточнить детали и возможность встречи..."
                className="w-full p-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">
                Способ обратной связи (по желанию)
              </label>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="Telegram, email или комната MCP"
                className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
              />
              <span className="text-[11px] text-[var(--muted)] mt-1 block">
                Будет передано только автору этого конкретного объявления.
              </span>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[var(--line)] rounded-lg text-[var(--ink)] hover:bg-[var(--surface)]"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Отправить отклик
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
