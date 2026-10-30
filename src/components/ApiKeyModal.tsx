import React, { useEffect, useState } from 'react';
import { getStoredApiKey, storeApiKey, createGuestSession } from '../lib/api';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (key: string) => void;
  /** Optional message explaining why the dialog opened (e.g. a 401). */
  reason?: string | null;
}

/**
 * Entry point for the API key. The key itself is created on the server by
 * `npm run key:issue -- --principal user:<slug> --name "<label>"`; this dialog
 * only stores it for this browser.
 */
export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSaved, reason }) => {
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(getStoredApiKey());
      setShowValue(false);
      setGuestError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGuestLogin = async () => {
    setIsGuestLoading(true);
    setGuestError(null);
    try {
      const data = await createGuestSession();
      onSaved(data.key);
      onClose();
    } catch (err: any) {
      setGuestError(err?.message || 'Ошибка создания гостевого аккаунта');
    } finally {
      setIsGuestLoading(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    storeApiKey(trimmed || null);
    onSaved(trimmed);
    onClose();
  };

  const handleClear = () => {
    storeApiKey(null);
    setValue('');
    onSaved('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-[var(--canvas)] border border-[var(--line)] rounded-2xl shadow-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 className="text-lg font-bold text-[var(--ink)]">🔑 API-ключ</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] text-xl leading-none cursor-pointer"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-[var(--muted)] mb-3 leading-relaxed">
          Каталог читается без ключа. Публикация, комнаты и чат с агентом требуют ключ: сервер
          проверяет его и записывает действия от имени владельца ключа.
        </p>

        <pre className="text-[11px] bg-[var(--surface)] border border-[var(--line)] rounded-lg p-3 mb-3 overflow-x-auto">
          npm run key:issue -- --principal user:ваш-логин --name "браузер"{'\n'}
          npm run key:issue -- --list
        </pre>

        <p className="text-xs text-[var(--muted)] mb-4">
          Ключ показывается один раз при выдаче. Он хранится в этом браузере (localStorage) и
          отправляется только на этот сервер в заголовке <code>Authorization</code>. Ключ в
          localStorage доступен любому скрипту на странице — не вставляйте сюда чужой или
          административный ключ.
        </p>

        {reason && (
          <div className="mb-4 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-2.5">
            {reason}
          </div>
        )}

        {/* 1-Click Guest Access Option */}
        <div className="mb-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-700 dark:text-emerald-400">
              <span>👤</span>
              <span>Вход для посетителей: Гостевой профиль</span>
            </div>
            <button
              type="button"
              disabled={isGuestLoading}
              onClick={handleGuestLogin}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-xs disabled:opacity-50"
            >
              {isGuestLoading ? 'Создание...' : 'Войти как Гость (1 клик)'}
            </button>
          </div>
          <p className="text-[11px] text-[var(--muted)] leading-relaxed">
            Создаёт ваш персональный изолированный профиль на сервере (например, <code>user:guest-…</code>). Ваши объявления и комнаты будут принадлежать только вам.
          </p>
          {guestError && (
            <div className="text-xs text-red-500">{guestError}</div>
          )}
        </div>

        {/* Clear Bearer Token Explanation for external MCP connectors */}
        <div className="mb-3 p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs space-y-1">
          <div className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
            <span>🔌</span>
            <span>Для коннекторов Claude, Cursor, DeepSeek MCP Lite и др.:</span>
          </div>
          <p className="text-[11px] text-[var(--muted)] leading-relaxed">
            Выданный ключ <code>mcr_...</code> — это и есть ваш <strong>Bearer токен</strong>. Если программа просит <em>«Bearer Token»</em> или <em>«API Key»</em>, вставляйте именно его. Если требуется заголовок вручную: <code>Authorization: Bearer &lt;ваш_ключ&gt;</code>.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] uppercase mb-1">
              Ключ Создателя или Администратора
            </label>
            <p className="text-xs text-[var(--muted)] mb-2">
              Если у вас есть персональный ключ (например, вы Создатель площадки или MCP-агент), вставьте его сюда:
            </p>
          </div>
          <label className="block text-xs font-semibold text-[var(--muted)] uppercase">
            Ключ (mcr_…)
          </label>
          <div className="flex gap-2">
            <input
              type={showValue ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="mcr_…"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-sm font-mono outline-none"
            />
            {value && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(value);
                  alert('API-ключ скопирован в буфер обмена!');
                }}
                className="px-3 h-10 border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--raised)] rounded-lg text-xs font-semibold text-[var(--blue)] cursor-pointer"
              >
                Копировать
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowValue((v) => !v)}
              className="px-3 h-10 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-xs text-[var(--ink)] cursor-pointer"
            >
              {showValue ? 'Скрыть' : 'Показать'}
            </button>
          </div>

          <div className="flex justify-between items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline cursor-pointer"
            >
              Забыть ключ в этом браузере
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 h-9 border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 h-9 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Сохранить
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
