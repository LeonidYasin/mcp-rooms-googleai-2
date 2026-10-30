import React, { useState } from 'react';
import { Listing } from '../types';
import { useI18n } from '../i18n';

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
  const { t, locale } = useI18n();
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[var(--canvas)] border border-[var(--line)] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--ink)]">
              {t('contact.title')}
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {t('contact.by_listing')} <strong>{listing.content.title}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] p-1 text-lg cursor-pointer"
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
              {t('contact.success_title')}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {t('contact.success_desc')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1.5">
                {t('contact.format')}
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
                    <span>{t('contact.private')}</span>
                  </div>
                  <span className="text-[11px] text-[var(--muted)] leading-tight">
                    {t('contact.private_desc')}
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
                    <span>{t('contact.public')}</span>
                  </div>
                  <span className="text-[11px] text-[var(--muted)] leading-tight">
                    {t('contact.public_desc')}
                  </span>
                </label>
              </div>
            </div>

            <div className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-xs text-[var(--muted)]">
              🔒 <strong>{locale === 'en' ? 'Safety principle:' : 'Принцип безопасности:'}</strong> {locale === 'en' ? 'phone number and exact address are never published. Communication begins inside a protected MCP room.' : 'телефон и точный адрес не публикуются автоматически. Общение начинается в защищённой комнате протокола MCP.'}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">
                {t('contact.message_label')}
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('contact.message_placeholder')}
                className="w-full p-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">
                {t('contact.feedback_label')}
              </label>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder={t('contact.feedback_placeholder')}
                className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
              />
              <span className="text-[11px] text-[var(--muted)] mt-1 block">
                {locale === 'en' ? 'Delivered only to the author of this specific listing.' : 'Будет передано только автору этого конкретного объявления.'}
              </span>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[var(--line)] rounded-lg text-[var(--ink)] hover:bg-[var(--surface)] cursor-pointer"
              >
                {t('modal.cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {t('contact.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
