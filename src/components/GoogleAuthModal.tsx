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
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
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
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              Подключите свой Google-аккаунт через официальный протокол <strong>Google Identity Services (OAuth 2.0)</strong>, чтобы отправлять запросы напрямую в Gemini.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] uppercase tracking-wider mb-1">
                Google Client ID (из Google Cloud Console)
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="например: 123456789-xyz.apps.googleusercontent.com"
                className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--line)] rounded-lg text-[var(--ink)] focus:outline-none focus:border-[var(--tint)]"
              />
              <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">
                В настройках Client ID добавьте в Authorized JavaScript origins ваш домен:{' '}
                <code className="text-xs text-sky-400">https://leonid-mcp.duckdns.org</code>
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleSignIn}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition disabled:opacity-50 cursor-pointer shadow-md"
              >
                {isLoading ? (
                  <span>Подключение...</span>
                ) : (
                  <>
                    <span>🔑</span>
                    <span>Войти через Google</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
