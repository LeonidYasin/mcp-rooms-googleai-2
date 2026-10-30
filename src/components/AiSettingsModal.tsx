import React, { useState, useEffect } from 'react';
import {
  LlmProviderType,
  PROVIDER_PRESETS,
  getStoredLlmConfig,
  storeLlmConfig,
  clearLlmConfig,
  UserLlmConfig,
} from '../lib/llmProviders';
import {
  getStoredGoogleToken,
  getStoredGoogleUser,
  clearGoogleAuth,
  signInWithGoogle,
  GoogleUserProfile,
} from '../lib/googleAuth';
import { McpIntegrationGuide } from './McpIntegrationGuide';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: UserLlmConfig | null) => void;
  onGuestLogin?: () => void;
  initialTab?: 'ai' | 'mcp' | 'profile';
}

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  onGuestLogin,
  initialTab = 'ai',
}) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'mcp' | 'profile'>(initialTab);
  const [selectedProvider, setSelectedProvider] = useState<LlmProviderType>('openrouter');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');

  const [activeConfig, setActiveConfig] = useState<UserLlmConfig | null>(null);
  const [isEditingKey, setIsEditingKey] = useState(false);

  // Google Profile State
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(null);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      const stored = getStoredLlmConfig();
      setActiveConfig(stored);
      if (stored) {
        setSelectedProvider(stored.provider);
        setApiKeyInput(stored.apiKey);
        setSelectedModel(stored.model);
        setCustomBaseUrl(stored.baseUrl || '');
        setIsEditingKey(false);
      } else {
        setSelectedProvider('openrouter');
        setApiKeyInput('');
        setSelectedModel(PROVIDER_PRESETS.openrouter.defaultModel);
        setCustomBaseUrl('');
        setIsEditingKey(true);
      }

      setGoogleUser(getStoredGoogleUser());
      setHasGoogleToken(Boolean(getStoredGoogleToken()));
      setNotice(null);
      setError(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const currentPreset = PROVIDER_PRESETS[selectedProvider];

  const handleProviderChange = (prov: LlmProviderType) => {
    setSelectedProvider(prov);
    setSelectedModel(PROVIDER_PRESETS[prov].defaultModel);
    setCustomModel('');
    if (prov === 'custom' && !customBaseUrl) {
      setCustomBaseUrl('http://localhost:11434/v1');
    }
  };

  const handleSaveLlmConfig = () => {
    const key = apiKeyInput.trim();
    if (!key && selectedProvider !== 'custom') {
      setError('Пожалуйста, введите API ключ выбранного провайдера.');
      return;
    }

    const effectiveModel = customModel.trim() || selectedModel || currentPreset.defaultModel;

    const newConfig: UserLlmConfig = {
      provider: selectedProvider,
      apiKey: key,
      model: effectiveModel,
      baseUrl: selectedProvider === 'custom' ? customBaseUrl.trim() : undefined,
    };

    storeLlmConfig(newConfig);
    setActiveConfig(newConfig);
    setIsEditingKey(false);
    setError(null);
    setNotice(`✨ Настройки ИИ сохранены! Активен провайдер: ${currentPreset.name} (${effectiveModel}).`);

    if (onConfigSaved) {
      onConfigSaved(newConfig);
    }
  };

  const handleRemoveLlmConfig = () => {
    clearLlmConfig();
    setActiveConfig(null);
    setApiKeyInput('');
    setIsEditingKey(true);
    setNotice('Настройки ИИ сброшены. Сервер переключен в базовый режим.');
    if (onConfigSaved) {
      onConfigSaved(null);
    }
  };

  const handleSignInGoogle = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      const res = await signInWithGoogle();
      setGoogleUser(res.user || null);
      setHasGoogleToken(true);
      setNotice('Вы успешно вошли через Google Аккаунт!');
    } catch (err: any) {
      setError(err?.message || 'Ошибка входа через Google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSignOutGoogle = () => {
    clearGoogleAuth();
    setGoogleUser(null);
    setHasGoogleToken(false);
    setNotice('Вы вышли из Google-аккаунта.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[var(--canvas)] border border-[var(--line)] rounded-2xl shadow-2xl p-5 md:p-6 my-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚙️</span>
            <div>
              <h3 className="text-base md:text-lg font-bold text-[var(--ink)]">
                Настройки ИИ, Ключи и Внешние MCP Агенты
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Выберите любую нейросеть для чата или подключите внешний Claude / ChatGPT
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] text-xl font-bold cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        {/* Global Notices */}
        {notice && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <span>✅</span>
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Top Modal Navigation Tabs */}
        <div className="flex gap-2 border-b border-[var(--line)] pb-3 mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'bg-[var(--blue)] text-white shadow-xs'
                : 'bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] border border-[var(--line)]'
            }`}
          >
            <span>✨ Выбор ИИ и Ключи</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mcp')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'mcp'
                ? 'bg-[var(--blue)] text-white shadow-xs'
                : 'bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] border border-[var(--line)]'
            }`}
          >
            <span>🔌 Подключение Claude / ChatGPT (MCP)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-[var(--blue)] text-white shadow-xs'
                : 'bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--ink)] border border-[var(--line)]'
            }`}
          >
            <span>👤 Профиль Google</span>
          </button>
        </div>

        {/* TAB 1: AI Provider Selection & Keys */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            {/* Active Provider Badge if already configured */}
            {activeConfig && !isEditingKey && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✨</span>
                  <div>
                    <strong className="text-xs md:text-sm text-emerald-600 dark:text-emerald-400 block font-bold">
                      Активен: {PROVIDER_PRESETS[activeConfig.provider]?.name || activeConfig.provider} ({activeConfig.model})
                    </strong>
                    <span className="text-[11px] text-[var(--muted)] font-mono">
                      Ключ: {activeConfig.apiKey.slice(0, 10)}••••••••••••••••
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingKey(true)}
                    className="px-3 py-1.5 text-xs text-[var(--ink)] border border-[var(--line)] rounded-xl hover:bg-[var(--raised)] transition cursor-pointer"
                  >
                    Сменить
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveLlmConfig}
                    className="px-3 py-1.5 text-xs text-red-500 border border-red-300 dark:border-red-900 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            )}

            {/* Editing or Setup Form */}
            {(!activeConfig || isEditingKey) && (
              <div className="space-y-4">
                {/* Provider Selector Buttons */}
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] uppercase tracking-wider mb-2">
                    1. Выберите провайдера нейросети:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleProviderChange('openrouter')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        selectedProvider === 'openrouter'
                          ? 'border-[var(--blue)] bg-[var(--soft)] ring-2 ring-blue-500/30'
                          : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--raised)]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink)]">
                        <span>🌐 OpenRouter</span>
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-600 font-bold px-1.5 py-0.2 rounded">Топ</span>
                      </div>
                      <span className="text-[11px] text-[var(--muted)] leading-tight">
                        DeepSeek, Llama, Claude, GPT в 1 ключе
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleProviderChange('gemini')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        selectedProvider === 'gemini'
                          ? 'border-[var(--blue)] bg-[var(--soft)] ring-2 ring-blue-500/30'
                          : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--raised)]'
                      }`}
                    >
                      <div className="font-bold text-xs text-[var(--ink)]">
                        🤖 Google Gemini
                      </div>
                      <span className="text-[11px] text-[var(--muted)] leading-tight">
                        Прямой ключ Google AI Studio
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleProviderChange('deepseek')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        selectedProvider === 'deepseek'
                          ? 'border-[var(--blue)] bg-[var(--soft)] ring-2 ring-blue-500/30'
                          : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--raised)]'
                      }`}
                    >
                      <div className="font-bold text-xs text-[var(--ink)]">
                        ⚡ DeepSeek
                      </div>
                      <span className="text-[11px] text-[var(--muted)] leading-tight">
                        Официальный API DeepSeek
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleProviderChange('openai')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        selectedProvider === 'openai'
                          ? 'border-[var(--blue)] bg-[var(--soft)] ring-2 ring-blue-500/30'
                          : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--raised)]'
                      }`}
                    >
                      <div className="font-bold text-xs text-[var(--ink)]">
                        🧠 OpenAI (ChatGPT)
                      </div>
                      <span className="text-[11px] text-[var(--muted)] leading-tight">
                        GPT-4o, GPT-4o-mini
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleProviderChange('custom')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        selectedProvider === 'custom'
                          ? 'border-[var(--blue)] bg-[var(--soft)] ring-2 ring-blue-500/30'
                          : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--raised)]'
                      }`}
                    >
                      <div className="font-bold text-xs text-[var(--ink)]">
                        ⚙️ Свой сервер / Ollama
                      </div>
                      <span className="text-[11px] text-[var(--muted)] leading-tight">
                        Локальный сервер или прокси
                      </span>
                    </button>
                  </div>
                </div>

                {/* Provider Info Card */}
                <div className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <strong className="text-[var(--ink)]">{currentPreset.name}</strong>
                    {currentPreset.docsUrl && (
                      <a
                        href={currentPreset.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1"
                      >
                        <span>Получить ключ ↗</span>
                      </a>
                    )}
                  </div>
                  <p className="text-[var(--muted)] leading-relaxed">{currentPreset.description}</p>
                </div>

                {/* Custom Base URL if custom provider */}
                {selectedProvider === 'custom' && (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[var(--ink)]">
                      Base URL (OpenAI-compatible):
                    </label>
                    <input
                      type="text"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      placeholder="http://localhost:11434/v1"
                      className="w-full px-3 py-2 text-xs font-mono bg-[var(--surface)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {/* Model Selection */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
                    2. Выберите модель:
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      setSelectedModel(e.target.value);
                      setCustomModel('');
                    }}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface)] border border-[var(--line)] rounded-xl text-[var(--ink)] outline-none cursor-pointer"
                  >
                    {currentPreset.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.isFree ? '— [Бесплатная]' : ''}
                      </option>
                    ))}
                  </select>

                  <div className="pt-1">
                    <input
                      type="text"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      placeholder="Или введите свой ID модели вручную..."
                      className="w-full px-3 py-1.5 text-xs font-mono bg-[var(--surface)] border border-[var(--line)] rounded-xl text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                    />
                  </div>
                </div>

                {/* API Key Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold text-[var(--ink)] uppercase tracking-wider">
                      3. Вставьте ваш API-ключ:
                    </label>
                  </div>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={currentPreset.keyPlaceholder}
                    className="w-full px-3.5 py-2 text-xs font-mono bg-[var(--surface)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-[var(--muted)]">
                    Ключ сохраняется локально в вашем браузере (localStorage) и используется для обращений к ИИ.
                  </p>
                </div>

                {/* Save button */}
                <div className="flex justify-between items-center pt-2">
                  {activeConfig && (
                    <button
                      type="button"
                      onClick={() => setIsEditingKey(false)}
                      className="px-4 py-2 text-xs text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      Отмена
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveLlmConfig}
                    className="ml-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer transition shadow-md"
                  >
                    Сохранить и активировать ИИ
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: External MCP Agents (Claude Desktop, Cursor, ChatGPT) */}
        {activeTab === 'mcp' && (
          <McpIntegrationGuide />
        )}

        {/* TAB 3: Google Profile & Guest Login */}
        {activeTab === 'profile' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">👤</span>
                  <span className="font-bold text-sm text-[var(--ink)]">Профиль Google Аккаунта</span>
                </div>
                {hasGoogleToken && googleUser?.email && (
                  <span className="text-[11px] bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold px-2.5 py-0.5 rounded-full border border-blue-500/30">
                    Авторизован
                  </span>
                )}
              </div>

              <p className="text-[var(--muted)] leading-relaxed">
                Привязывает ваш email и имя к публикуемым карточкам объявлений и комнатам переговоров.
              </p>

              {hasGoogleToken && googleUser?.email ? (
                <div className="p-3 bg-[var(--canvas)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {googleUser.picture ? (
                      <img
                        src={googleUser.picture}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full border border-[var(--line)]"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                        {googleUser.email[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--ink)] truncate">{googleUser.name || googleUser.email}</p>
                      <p className="text-[11px] text-[var(--muted)] truncate">{googleUser.email}</p>
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
                  disabled={isGoogleLoading}
                  onClick={handleSignInGoogle}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border border-[var(--line)] bg-[var(--canvas)] hover:bg-[var(--raised)] text-[var(--ink)] transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <span>🌐</span>
                  <span>{isGoogleLoading ? 'Авторизация в Google...' : 'Войти через Google Аккаунт'}</span>
                </button>
              )}
            </div>

            {onGuestLogin && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onGuestLogin}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--raised)] transition cursor-pointer"
                >
                  <span>👤</span>
                  <span>Быстрый вход как Гость (в 1 клик)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-[var(--line)] mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-[var(--surface)] hover:bg-[var(--raised)] border border-[var(--line)] text-[var(--ink)] transition cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
