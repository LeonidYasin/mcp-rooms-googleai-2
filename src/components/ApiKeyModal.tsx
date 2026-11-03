import React, { useEffect, useState } from 'react';
import {
  getStoredApiKey,
  storeApiKey,
  createGuestSession,
  getEmbeddingStatus,
  configureEmbeddingKey,
  triggerEmbeddingReindex,
  getCurrentAuthStatus,
  EmbeddingStatusResponse,
  CurrentAuthMeResponse,
} from '../lib/api';
import { useI18n } from '../i18n';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (key: string) => void;
  /** Optional message explaining why the dialog opened (e.g. a 401 or need AI key). */
  reason?: string | null;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSaved, reason }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'mcp'>('profile');

  // Profile Tab state
  const [keyValue, setKeyValue] = useState('');
  const [showKeyValue, setShowKeyValue] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [authMe, setAuthMe] = useState<CurrentAuthMeResponse | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // AI & Embeddings Tab state
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingStatusResponse | null>(null);
  const [isEmbeddingLoading, setIsEmbeddingLoading] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexMessage, setReindexMessage] = useState<string | null>(null);

  // MCP Tab state
  const [mcpUrlCopied, setMcpUrlCopied] = useState(false);
  const [mcpConfigCopied, setMcpConfigCopied] = useState(false);
  const [mcpFormat, setMcpFormat] = useState<'claude' | 'cursor'>('claude');

  // Load current states on modal open
  useEffect(() => {
    if (!isOpen) return;

    const currentKey = getStoredApiKey();
    setKeyValue(currentKey);
    setShowKeyValue(false);
    setGuestError(null);
    setAiError(null);
    setAiSuccess(null);
    setReindexMessage(null);
    setTokenCopied(false);
    setMcpUrlCopied(false);
    setMcpConfigCopied(false);

    // If reason mentions AI or embedding, start on AI tab
    if (reason && (reason.toLowerCase().includes('ai') || reason.toLowerCase().includes('embedding'))) {
      setActiveTab('ai');
    } else {
      setActiveTab('profile');
    }

    // Refresh auth profile
    getCurrentAuthStatus().then(setAuthMe).catch(() => setAuthMe(null));

    // Refresh embedding status
    setIsEmbeddingLoading(true);
    getEmbeddingStatus()
      .then(setEmbeddingStatus)
      .catch(() => setEmbeddingStatus(null))
      .finally(() => setIsEmbeddingLoading(false));
  }, [isOpen, reason]);

  if (!isOpen) return null;

  // Tab 1: Profile Handlers
  const handleGuestLogin = async () => {
    setIsGuestLoading(true);
    setGuestError(null);
    try {
      const data = await createGuestSession();
      setKeyValue(data.key);
      onSaved(data.key);
      const auth = await getCurrentAuthStatus();
      setAuthMe(auth);
    } catch (err: any) {
      setGuestError(err?.message || 'Ошибка создания гостевого аккаунта');
    } finally {
      setIsGuestLoading(false);
    }
  };

  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyValue.trim();
    storeApiKey(trimmed || null);
    onSaved(trimmed);
    getCurrentAuthStatus().then(setAuthMe).catch(() => setAuthMe(null));
  };

  const handleLogout = () => {
    storeApiKey(null);
    setKeyValue('');
    onSaved('');
    setAuthMe({ authenticated: false, principal: null });
  };

  const handleCopyToken = () => {
    if (!keyValue) return;
    navigator.clipboard.writeText(keyValue);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  // Tab 2: AI Handlers
  const handleTestAndSaveGeminiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = geminiKeyInput.trim();
    if (!trimmed) {
      setAiError('Введите API-ключ Gemini');
      return;
    }

    setIsTestingKey(true);
    setAiError(null);
    setAiSuccess(null);

    try {
      const res = await configureEmbeddingKey(trimmed);
      setEmbeddingStatus(res.status);
      setAiSuccess(t('connect_modal.ai_key_saved_success'));
      setGeminiKeyInput('');
    } catch (err: any) {
      setAiError(err?.message || 'Ошибка проверки ключа Google AI');
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleResetGeminiKey = async () => {
    setIsTestingKey(true);
    setAiError(null);
    setAiSuccess(null);

    try {
      const res = await configureEmbeddingKey('');
      setEmbeddingStatus(res.status);
      setAiSuccess(t('connect_modal.ai_key_reset_success'));
    } catch (err: any) {
      setAiError(err?.message || 'Ошибка сброса ключа');
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleReindex = async () => {
    setIsReindexing(true);
    setReindexMessage(null);
    setAiError(null);

    try {
      const res = await triggerEmbeddingReindex(true);
      setReindexMessage(
        `${t('connect_modal.ai_reindex_success')} (Всего: ${res.total}, Индексировано: ${res.indexed}, Пропущено: ${res.skipped})`
      );
      if (res.status) {
        setEmbeddingStatus(res.status);
      }
    } catch (err: any) {
      setAiError(err?.message || 'Ошибка переиндексации');
    } finally {
      setIsReindexing(false);
    }
  };

  // Tab 3: MCP Handlers
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const mcpEndpointUrl = `${currentOrigin}/mcp`;

  const claudeConfigJson = JSON.stringify(
    {
      mcpServers: {
        'mcp-rooms': {
          url: mcpEndpointUrl,
          headers: keyValue ? { Authorization: `Bearer ${keyValue}` } : undefined,
        },
      },
    },
    null,
    2
  );

  const cursorConfigJson = JSON.stringify(
    {
      name: 'mcp-rooms',
      type: 'sse',
      url: mcpEndpointUrl,
      headers: keyValue ? { Authorization: `Bearer ${keyValue}` } : {},
    },
    null,
    2
  );

  const handleCopyMcpUrl = () => {
    navigator.clipboard.writeText(mcpEndpointUrl);
    setMcpUrlCopied(true);
    setTimeout(() => setMcpUrlCopied(false), 2000);
  };

  const handleCopyMcpConfig = () => {
    const text = mcpFormat === 'claude' ? claudeConfigJson : cursorConfigJson;
    navigator.clipboard.writeText(text);
    setMcpConfigCopied(true);
    setTimeout(() => setMcpConfigCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[var(--canvas)] border border-[var(--line)] rounded-2xl shadow-2xl my-auto max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between shrink-0 bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🔌</span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] leading-tight">
                {t('connect_modal.title')}
              </h2>
              <p className="text-xs text-[var(--muted)] hidden sm:block">
                Управление авторизацией, семантическим AI-поиском и MCP-агентами
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] text-xl leading-none cursor-pointer p-1.5 rounded-lg hover:bg-[var(--raised)] transition-colors"
            aria-label={t('modal.close')}
          >
            ✕
          </button>
        </div>

        {/* Reason Alert (if opened due to a restriction or error) */}
        {reason && (
          <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <span>⚠️</span>
            <span>{reason}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--line)] bg-[var(--canvas)] shrink-0 px-2 sm:px-5">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[var(--blue)] text-[var(--blue)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <span>👤</span>
            <span>{t('connect_modal.tab_profile')}</span>
            {authMe?.authenticated && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'ai'
                ? 'border-[var(--blue)] text-[var(--blue)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <span>✨</span>
            <span>{t('connect_modal.tab_ai')}</span>
            {embeddingStatus?.isAvailable && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mcp')}
            className={`flex-1 py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'mcp'
                ? 'border-[var(--blue)] text-[var(--blue)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <span>🤖</span>
            <span>{t('connect_modal.tab_mcp')}</span>
          </button>
        </div>

        {/* Body content based on activeTab */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4">
          {/* TAB 1: PROFILE & ACCESS */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* Current Auth Status Card */}
              <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {t('connect_modal.profile_active')}
                  </span>
                  {authMe?.authenticated ? (
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>{authMe.principal?.principalId}</span>
                        {authMe.principal?.isGuest && (
                          <span className="opacity-80">({t('connect_modal.profile_guest_badge')})</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                      >
                        {t('connect_modal.profile_logout_btn')}
                      </button>
                    </div>
                  ) : (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      {t('connect_modal.profile_anonymous')}
                    </span>
                  )}
                </div>

                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {t('connect_modal.profile_explanation')}
                </p>

                {keyValue && (
                  <div className="pt-2 border-t border-[var(--line)] space-y-1.5">
                    <label className="text-[11px] font-semibold text-[var(--muted)] block">
                      {t('connect_modal.profile_token_label')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type={showKeyValue ? 'text' : 'password'}
                        readOnly
                        value={keyValue}
                        className="flex-1 h-9 px-3 border border-[var(--line)] rounded-lg bg-[var(--canvas)] text-xs font-mono text-[var(--ink)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeyValue((v) => !v)}
                        className="px-2.5 h-9 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-xs hover:bg-[var(--raised)] cursor-pointer"
                      >
                        {showKeyValue ? t('keymodal.hide') : t('keymodal.show')}
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyToken}
                        className="px-3 h-9 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                      >
                        {tokenCopied ? '✓' : t('keymodal.copy_btn')}
                      </button>
                    </div>
                    {tokenCopied && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        {t('connect_modal.token_copied')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 1-Click Guest Option */}
              <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <span>👤</span>
                      <span>{t('connect_modal.guest_title')}</span>
                    </h3>
                    <p className="text-xs text-[var(--muted)] leading-relaxed mt-1">
                      {t('connect_modal.guest_desc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isGuestLoading}
                    onClick={handleGuestLogin}
                    className="self-start sm:self-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-xs disabled:opacity-50 whitespace-nowrap"
                  >
                    {isGuestLoading ? t('connect_modal.guest_loading') : t('connect_modal.guest_btn')}
                  </button>
                </div>
                {guestError && (
                  <div className="text-xs text-red-600 dark:text-red-400 font-medium">{guestError}</div>
                )}
              </div>

              {/* Manual Token Input */}
              <form onSubmit={handleSaveToken} className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] space-y-2.5">
                <h3 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wide">
                  {t('connect_modal.manual_title')}
                </h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {t('connect_modal.manual_desc')}
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={keyValue}
                    onChange={(e) => setKeyValue(e.target.value)}
                    placeholder={t('connect_modal.token_input_placeholder')}
                    className="flex-1 h-9 px-3 border border-[var(--line)] rounded-lg bg-[var(--canvas)] text-xs font-mono outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 h-9 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                  >
                    {t('connect_modal.save_token_btn')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: AI & EMBEDDINGS */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              {/* Real-time AI Status Card */}
              <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {t('connect_modal.ai_status_title')}
                  </span>
                  {isEmbeddingLoading ? (
                    <span className="text-xs text-[var(--muted)] animate-pulse">Загрузка статуса...</span>
                  ) : embeddingStatus?.isAvailable ? (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{t('connect_modal.ai_status_active')}</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 flex items-center gap-1.5">
                      <span>⚡</span>
                      <span>{t('connect_modal.ai_status_fallback')}</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {embeddingStatus?.reason || 'Статус определяется...'}
                  {embeddingStatus?.keyMasked && (
                    <span className="ml-1 font-mono text-[var(--ink)]">({embeddingStatus.keyMasked})</span>
                  )}
                </p>

                {embeddingStatus?.isAvailable && (
                  <div className="pt-2 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={isReindexing}
                      onClick={handleReindex}
                      className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--raised)] text-[var(--ink)] text-xs font-semibold rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {isReindexing ? t('connect_modal.ai_reindexing') : t('connect_modal.ai_reindex_btn')}
                    </button>
                    <button
                      type="button"
                      disabled={isTestingKey}
                      onClick={handleResetGeminiKey}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                    >
                      {t('connect_modal.ai_reset_btn')}
                    </button>
                  </div>
                )}
                {reindexMessage && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {reindexMessage}
                  </div>
                )}
              </div>

              {/* Friendly Explanation & Free Tier Promo */}
              <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✨</span>
                  <h3 className="text-xs sm:text-sm font-bold text-blue-950 dark:text-blue-300">
                    {t('connect_modal.ai_why_title')}
                  </h3>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {t('connect_modal.ai_why_desc')}
                </p>
                <div className="p-2.5 rounded-lg bg-white/80 dark:bg-black/30 border border-blue-200/60 dark:border-blue-900/60 text-[11px] text-blue-900 dark:text-blue-200 font-medium flex items-center gap-2">
                  <span>🎁</span>
                  <span>{t('connect_modal.ai_free_badge')}</span>
                </div>
                <div>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-2xs"
                  >
                    <span>{t('connect_modal.ai_get_key_btn')}</span>
                  </a>
                </div>
              </div>

              {/* Gemini API Key Form */}
              <form onSubmit={handleTestAndSaveGeminiKey} className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] space-y-3">
                <label className="block text-xs font-bold text-[var(--ink)] uppercase tracking-wide">
                  {t('connect_modal.ai_key_input_label')}
                </label>
                <div className="flex gap-2">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder={t('connect_modal.ai_key_input_placeholder')}
                    className="flex-1 h-9 px-3 border border-[var(--line)] rounded-lg bg-[var(--canvas)] text-xs font-mono outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey((v) => !v)}
                    className="px-2.5 h-9 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-xs hover:bg-[var(--raised)] cursor-pointer"
                  >
                    {showGeminiKey ? t('keymodal.hide') : t('keymodal.show')}
                  </button>
                  <button
                    type="submit"
                    disabled={isTestingKey}
                    className="px-4 h-9 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-xs disabled:opacity-50 whitespace-nowrap"
                  >
                    {isTestingKey ? t('connect_modal.ai_testing') : t('connect_modal.ai_test_and_save_btn')}
                  </button>
                </div>
                {aiError && (
                  <div className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-2.5">
                    {aiError}
                  </div>
                )}
                {aiSuccess && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg p-2.5">
                    {aiSuccess}
                  </div>
                )}
              </form>
            </div>
          )}

          {/* TAB 3: AGENTS & MCP */}
          {activeTab === 'mcp' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <h3 className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                    {t('connect_modal.mcp_title')}
                  </h3>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {t('connect_modal.mcp_desc')}
                </p>
              </div>

              {/* MCP Endpoint URL */}
              <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] space-y-2">
                <label className="text-xs font-bold text-[var(--ink)] block uppercase tracking-wide">
                  {t('connect_modal.mcp_endpoint_label')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={mcpEndpointUrl}
                    className="flex-1 h-9 px-3 border border-[var(--line)] rounded-lg bg-[var(--canvas)] text-xs font-mono text-[var(--ink)]"
                  />
                  <button
                    type="button"
                    onClick={handleCopyMcpUrl}
                    className="px-3.5 h-9 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-2xs"
                  >
                    {mcpUrlCopied ? '✓' : t('keymodal.copy_btn')}
                  </button>
                </div>
                {mcpUrlCopied && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {t('connect_modal.mcp_endpoint_copied')}
                  </p>
                )}
              </div>

              {/* Config Snippet for Claude Desktop & Cursor */}
              <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--ink)] uppercase tracking-wide">
                      {t('connect_modal.mcp_config_title')}
                    </span>
                    <div className="flex rounded-md border border-[var(--line)] p-0.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setMcpFormat('claude')}
                        className={`px-2 py-0.5 rounded cursor-pointer ${
                          mcpFormat === 'claude'
                            ? 'bg-[var(--blue)] text-white font-bold'
                            : 'text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        Claude Desktop
                      </button>
                      <button
                        type="button"
                        onClick={() => setMcpFormat('cursor')}
                        className={`px-2 py-0.5 rounded cursor-pointer ${
                          mcpFormat === 'cursor'
                            ? 'bg-[var(--blue)] text-white font-bold'
                            : 'text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        Cursor
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyMcpConfig}
                    className="text-xs text-[var(--blue)] hover:underline cursor-pointer font-semibold"
                  >
                    {mcpConfigCopied ? '✓ Скопировано' : 'Копировать JSON'}
                  </button>
                </div>

                <pre className="text-[11px] bg-[var(--canvas)] border border-[var(--line)] rounded-lg p-3 overflow-x-auto font-mono text-[var(--ink)]">
                  {mcpFormat === 'claude' ? claudeConfigJson : cursorConfigJson}
                </pre>
              </div>

              {/* Plugin Download Card */}
              <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-blue-950 dark:text-blue-300">
                    {t('connect_modal.mcp_plugin_title')}
                  </h4>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {t('connect_modal.mcp_plugin_desc')}
                  </p>
                </div>
                <a
                  href="/deepseek-mcp-lite.zip"
                  download="deepseek-mcp-lite.zip"
                  className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs whitespace-nowrap"
                >
                  <span>{t('connect_modal.mcp_download_plugin')}</span>
                </a>
              </div>

              {/* MCP Tools List */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wide block">
                  {t('connect_modal.mcp_tools_title')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'search_listings',
                    'match_listings',
                    'create_listing',
                    'preview_listing',
                    'publish_listing',
                    'withdraw_listing',
                    'join_room',
                    'send_message',
                    'get_room_history',
                    'negotiate_agreement',
                    'get_profile',
                    'get_embedding_status',
                  ].map((toolName) => (
                    <span
                      key={toolName}
                      className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--line)] rounded text-[11px] font-mono text-[var(--ink)]"
                    >
                      {toolName}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--surface)] flex justify-end items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9 bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--raised)] text-[var(--ink)] text-xs sm:text-sm font-semibold rounded-lg cursor-pointer transition-colors"
          >
            {t('modal.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ConnectionModal = ApiKeyModal;
