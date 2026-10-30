import React, { useState, useEffect } from 'react';
import {
  getStoredGoogleClientId,
  storeGoogleClientId,
  getStoredGoogleToken,
  getStoredGoogleUser,
  clearGoogleAuth,
  getStoredGeminiApiKey,
  storeGeminiApiKey,
  signInWithGoogle,
  GoogleUserProfile,
} from '../lib/googleAuth';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: (token: string, user?: GoogleUserProfile) => void;
  onGuestLogin?: () => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  onGuestLogin,
}) => {
  const [clientId, setClientId] = useState('');
  const [user, setUser] = useState<GoogleUserProfile | null>(null);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setClientId(getStoredGoogleClientId());
      setUser(getStoredGoogleUser());
      setHasGoogleToken(Boolean(getStoredGoogleToken()));
      const currentKey = getStoredGeminiApiKey();
      setGeminiKey(currentKey);
      setKeyInput(currentKey);
      setIsEditingKey(!currentKey);
      setError(null);
      setSuccessNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSignInGoogle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      storeGoogleClientId(clientId);
      const res = await signInWithGoogle(clientId);
      setUser(res.user || null);
      setHasGoogleToken(true);
      setSuccessNotice('Вы успешно вошли через Google Аккаунт!');
      if (onAuthSuccess) {
        onAuthSuccess(res.accessToken, res.user);
      }
    } catch (err: any) {
      setError(err?.message || 'Ошибка входа через Google OAuth');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOutGoogle = () => {
    clearGoogleAuth();
    setUser(null);
    setHasGoogleToken(false);
    setSuccessNotice('Вы вышли из Google-аккаунта.');
  };

  const handleSaveGeminiKey = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setError('Пожалуйста, введите корректный ключ Gemini API');
      return;
    }
    storeGeminiApiKey(trimmed);
    setGeminiKey(trimmed);
    setIsEditingKey(false);
    setError(null);
    setSuccessNotice('✨ Gemini API ключ успешно сохранён! Теперь Ангел общается свободно через живой ИИ.');
    if (onAuthSuccess) {
      onAuthSuccess('gemini_key');
    }
  };

  const handleRemoveGeminiKey = () => {
    storeGeminiApiKey('');
    setGeminiKey('');
    setKeyInput('');
    setIsEditingKey(true);
    setSuccessNotice('Gemini API ключ удалён.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-[var(--canvas)] border border-[var(--line)] rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">✨</span>
            <div>
              <h3 className="text-base md:text-lg font-bold text-[var(--ink)]">
                Подключение Google Gemini и Профиля
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Настройте живой ИИ для свободного общения с Агентом-Ангелом
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] text-xl font-bold cursor-pointer p-1"
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* Success or Error Notice */}
        {successNotice && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <span>✅</span>
            <span>{successNotice}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-5">
          {/* Section 1: Gemini API Key (The Live Brain of the Angel) */}
          <div className="p-4 bg-gradient-to-br from-indigo-50/70 via-blue-50/50 to-purple-50/40 dark:from-indigo-950/40 dark:via-blue-950/30 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <span className="font-bold text-sm text-[var(--ink)]">
                  Google Gemini (Живой ИИ)
                </span>
              </div>
              {geminiKey && !isEditingKey && (
                <span className="text-[11px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  Активен
                </span>
              )}
            </div>

            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Чтобы Агент-Ангел общался на любые темы, шутил, давал советы и размышлял как живой собеседник, подключите ваш бесплатный Gemini API ключ.
            </p>

            {geminiKey && !isEditingKey ? (
              <div className="space-y-2 pt-1">
                <div className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-emerald-500 font-mono text-sm">🔑</span>
                    <span className="text-xs font-mono text-[var(--ink)] truncate">
                      {geminiKey.slice(0, 10)}••••••••••••••••
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsEditingKey(true)}
                      className="px-2.5 py-1 text-xs text-[var(--ink)] border border-[var(--line)] rounded-lg hover:bg-[var(--raised)] transition cursor-pointer"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveGeminiKey}
                      className="px-2.5 py-1 text-xs text-red-500 border border-red-300 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--muted)]">Бесплатный ключ из Google AI Studio:</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1"
                  >
                    <span>Получить ключ (1 клик)</span>
                    <span>↗</span>
                  </a>
                </div>

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="Вставьте ключ вида AIzaSy..."
                    className="flex-1 px-3.5 py-2 text-xs font-mono bg-[var(--surface)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveGeminiKey}
                    disabled={!keyInput.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-xs disabled:opacity-50"
                  >
                    Сохранить
                  </button>
                </div>

                <div className="text-[11px] text-[var(--muted)] flex items-center gap-1">
                  <span>💡</span>
                  <span>
                    Google выдаёт ключ бесплатно и без банковских карт. Никаких проверок и предупреждений!
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Google Account Profile */}
          <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">👤</span>
                <span className="font-bold text-sm text-[var(--ink)]">
                  Профиль Google
                </span>
              </div>
              {hasGoogleToken && user?.email && (
                <span className="text-[11px] bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold px-2.5 py-0.5 rounded-full border border-blue-500/30">
                  Авторизован
                </span>
              )}
            </div>

            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Привязывает ваш аккаунт Google к объявлениям и комнатам переговоров на площадке.
            </p>

            {hasGoogleToken && user?.email ? (
              <div className="p-3 bg-[var(--canvas)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name || 'User'}
                      className="w-8 h-8 rounded-full border border-[var(--line)]"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      {user.email[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--ink)] truncate">
                      {user.name || user.email}
                    </p>
                    <p className="text-[11px] text-[var(--muted)] truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOutGoogle}
                  className="px-3 py-1.5 text-xs text-red-500 border border-red-300 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer shrink-0"
                >
                  Выйти
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isLoading}
                onClick={handleSignInGoogle}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border border-[var(--line)] bg-[var(--canvas)] hover:bg-[var(--raised)] text-[var(--ink)] transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                <span>🌐</span>
                <span>{isLoading ? 'Авторизация в Google...' : 'Войти через Google Аккаунт'}</span>
              </button>
            )}

            <div className="text-[11px] text-[var(--muted)] flex items-start gap-1">
              <span>ℹ️</span>
              <span>
                Вход через Google авторизует профиль. Для работы живого интеллекта Gemini укажите ключ в секции выше.
              </span>
            </div>
          </div>

          {/* Guest login option */}
          {onGuestLogin && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onGuestLogin}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--raised)] transition cursor-pointer"
              >
                <span>👤</span>
                <span>Быстрый вход как Гость (в 1 клик без регистрации)</span>
              </button>
            </div>
          )}

          {/* Admin Client ID Details */}
          <details className="text-xs text-[var(--muted)] pt-2 border-t border-[var(--line)]">
            <summary className="cursor-pointer hover:text-[var(--ink)] select-none">
              ⚙️ Настройки Client ID (для администратора)
            </summary>
            <div className="mt-2 space-y-2 pt-1">
              <label className="block text-[11px] font-semibold text-[var(--ink)] uppercase tracking-wider">
                Google OAuth Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Client ID..."
                className="w-full px-3 py-1.5 text-xs font-mono bg-[var(--surface)] border border-[var(--line)] rounded-lg text-[var(--ink)] focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                Домен в Authorized JavaScript origins: <code className="text-sky-400">https://leonid-mcp.duckdns.org</code>
              </p>
            </div>
          </details>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white transition cursor-pointer shadow-xs"
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};