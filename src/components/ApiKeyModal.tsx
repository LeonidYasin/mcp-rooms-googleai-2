import React, { useEffect, useState } from 'react';
import { fetchIdentity, getStoredApiKey, storeApiKey, type Identity, type IdentityResult } from '../lib/api';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (key: string) => void;
  /** Optional message explaining why the dialog opened (e.g. a 401). */
  reason?: string | null;
}

const SCOPE_LABELS: Record<string, string> = {
  'rooms:read': 'чтение комнат',
  'rooms:write': 'переписка в комнатах',
  'listings:read': 'чтение витрины',
  'listings:write': 'публикация объявлений',
};

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(ms);
  }
}

/**
 * Entry point for the API key. The key itself is issued by the operator:
 *   npm run auth -- user create --name "…"
 *   npm run auth -- key issue --user user:… --name "браузер"
 * This dialog verifies the key with `GET /identity` and stores it in this browser.
 */
export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSaved, reason }) => {
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<IdentityResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValue(getStoredApiKey());
    setShowValue(false);
    setResult(null);
    setSaveError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const identity: Identity | null = result?.ok ? result.identity : null;
  const failure = result && !result.ok ? result.failure : null;

  const verify = async (key: string) => {
    setChecking(true);
    setSaveError(null);
    const checked = await fetchIdentity(key);
    setResult(checked);
    setChecking(false);
    return checked;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setSaveError('Вставьте ключ, выданный командой npm run auth.');
      return;
    }
    const checked = await verify(trimmed);
    if (!checked.ok) {
      setSaveError(
        checked.failure.status === 401
          ? 'Сервер не принял ключ: он неизвестен, отозван, истёк или принадлежит отключённому пользователю (401).'
          : `Проверка ключа не удалась: ${checked.failure.message} (${checked.failure.status}).`
      );
      return;
    }
    storeApiKey(trimmed);
    onSaved(trimmed);
    onClose();
  };

  const handleClear = () => {
    storeApiKey(null);
    setValue('');
    setResult(null);
    setSaveError(null);
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
          Витрина читается без ключа. Публикация, комнаты и чат с агентом требуют ключ: сервер
          проверяет его и записывает действия от имени владельца ключа. У ключа есть области
          действия и срок жизни — их задаёт оператор при выдаче.
        </p>

        <pre className="text-[11px] bg-[var(--surface)] border border-[var(--line)] rounded-lg p-3 mb-3 overflow-x-auto">
          npm run auth -- user create --name "Ваше имя"{'\n'}
          npm run auth -- key issue --user user:… --name "браузер"{'\n'}
          npm run auth -- key list
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

        <form onSubmit={handleSave} className="space-y-3">
          <label className="block text-xs font-semibold text-[var(--muted)] uppercase">
            Ключ (mcr_…)
          </label>
          <div className="flex gap-2">
            <input
              type={showValue ? 'text' : 'password'}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setResult(null);
                setSaveError(null);
              }}
              placeholder="mcr_…"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-sm font-mono outline-none"
            />
            <button
              type="button"
              onClick={() => setShowValue((v) => !v)}
              className="px-3 h-10 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-xs text-[var(--ink)] cursor-pointer"
            >
              {showValue ? 'Скрыть' : 'Показать'}
            </button>
            <button
              type="button"
              onClick={() => void verify(value.trim())}
              disabled={checking || !value.trim()}
              className="px-3 h-10 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-xs text-[var(--ink)] cursor-pointer disabled:opacity-50"
            >
              {checking ? 'Проверяю…' : 'Проверить'}
            </button>
          </div>

          {identity && (
            <div className="text-xs bg-[var(--surface)] border border-[var(--line)] rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between gap-3">
                <span className="text-[var(--muted)]">Пользователь</span>
                <span className="font-mono text-[var(--ink)]">{identity.user_id}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--muted)]">Имя</span>
                <span className="text-[var(--ink)]">{identity.display_name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--muted)]">Ключ</span>
                <span className="font-mono text-[var(--ink)]">{identity.credential_id.slice(0, 12)}…</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--muted)]">Действует до</span>
                <span className="text-[var(--ink)]">{formatDate(identity.expires_at)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {identity.scopes.map((scope) => (
                  <span
                    key={scope}
                    title={SCOPE_LABELS[scope] || scope}
                    className="px-2 py-0.5 rounded-full bg-[var(--canvas)] border border-[var(--line)] font-mono text-[10px] text-[var(--ink)]"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          )}

          {failure && (
            <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-2.5">
              {failure.status === 401
                ? 'Ключ не принят: неизвестен, отозван, истёк или пользователь отключён (401).'
                : `Проверка не удалась: ${failure.message} (${failure.status}).`}
            </div>
          )}

          {saveError && (
            <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-2.5">
              {saveError}
            </div>
          )}

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
                disabled={checking}
                className="px-4 h-9 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-60"
              >
                {checking ? 'Проверяю…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
