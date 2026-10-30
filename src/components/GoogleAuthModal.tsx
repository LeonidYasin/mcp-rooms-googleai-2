import React, { useState, useEffect } from 'react';
import {
  getStoredGoogleClientId,
  storeGoogleClientId,
  getStoredGoogleToken,
  getStoredGoogleUser,
  clearGoogleAuth,
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
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setClientId(getStoredGoogleClientId());
      setUser(getStoredGoogleUser());
      setHasToken(Boolean(getStoredGoogleToken()));
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      storeGoogleClientId(clientId);
      const res = await signInWithGoogle(clientId);
      setUser(res.user || null);
      setHasToken(true);
      if (onAuthSuccess) {
        onAuthSuccess(res.accessToken, res.user);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Ошибка входа через Google OAuth');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    clearGoogleAuth();
    setUser(null);
    setHasToken(false);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-[var(--canvas)] border border-[var(--line)] rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌐</span>
            <h3 className="text-lg font-bold text-[var(--ink)]">Google OAuth 2.0 (Gemini)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {hasToken ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-semibold text-emerald-400">Подключено к Google Gemini</p>
                {user?.email && (
                  <p className="text-sm text-[var(--muted)]">Аккаунт: {user.email}</p>
                )}
              </div>
            </div>

            <p className="text-sm text-[var(--muted)] leading-relaxed">
              Ваш персональный аккаунт Google подключен. Запросы к AI-ассистенту Angel в чате
              будут использовать вашу личную квоту Gemini через защищённый протокол OAuth 2.0.
            </p>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={handleSignOut}
                className="px-4 py-2 text-sm rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition cursor-pointer"
              >
                Отключить аккаунт
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-[var(--tint)] text-white hover:opacity-90 transition cursor-pointer"
              >
                Готово
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <h4 className="font-semibold text-[var(--ink)] text-sm">Персональный Google Gemini</h4>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Нажмите кнопку ниже, чтобы авторизоваться через Google. Запросы к Агенту-Ангелу будут обрабатываться моделью <strong>Google Gemini</strong> от имени вашего аккаунта.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleSignIn}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition disabled:opacity-50 cursor-pointer shadow-md"
              >
                {isLoading ? (
                  <span>Подключение к Google...</span>
                ) : (
                  <>
                    <span>🌐</span>
                    <span>Войти через Google</span>
                  </>
                )}
              </button>

              {onGuestLogin && (
                <button
                  type="button"
                  onClick={onGuestLogin}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--raised)] transition cursor-pointer"
                >
                  <span>👤</span>
                  <span>Продолжить как Гость (без Google)</span>
                </button>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                {error}
              </div>
            )}

            <details className="text-xs text-[var(--muted)] pt-2 border-t border-[var(--line)]">
              <summary className="cursor-pointer hover:text-[var(--ink)] select-none">
                ⚙️ Настройки Client ID (для администраторов)
              </summary>
              <div className="mt-2 space-y-2 pt-1">
                <label className="block text-[11px] font-semibold text-[var(--ink)] uppercase tracking-wider">
                  Google Client ID
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Client ID..."
                  className="w-full px-3 py-1.5 text-xs font-mono bg-[var(--surface)] border border-[var(--line)] rounded-lg text-[var(--ink)] focus:outline-none focus:border-[var(--tint)]"
                />
                <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                  Домен в Authorized JavaScript origins:{' '}
                  <code className="text-sky-400">https://leonid-mcp.duckdns.org</code>
                </p>
              </div>
            </details>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
