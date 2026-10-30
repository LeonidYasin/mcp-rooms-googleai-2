/**
 * Multi-Provider LLM Configuration and Local Persistence.
 * Supports OpenRouter, Google Gemini, DeepSeek, OpenAI, and Custom OpenAI-compatible endpoints.
 */

export type LlmProviderType = 'openrouter' | 'gemini' | 'deepseek' | 'openai' | 'custom';

export interface UserLlmConfig {
  provider: LlmProviderType;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface ModelPreset {
  id: string;
  name: string;
  description: string;
  isFree?: boolean;
}

export const PROVIDER_PRESETS: Record<LlmProviderType, {
  name: string;
  description: string;
  docsUrl: string;
  defaultModel: string;
  keyPlaceholder: string;
  models: ModelPreset[];
}> = {
  openrouter: {
    name: 'OpenRouter',
    description: 'Более 200 моделей нейросетей по одному ключу (DeepSeek V3, Llama 3.3, Claude, GPT-4o). Есть бесплатные модели.',
    docsUrl: 'https://openrouter.ai/keys',
    defaultModel: 'deepseek/deepseek-chat:free',
    keyPlaceholder: 'sk-or-v1-...',
    models: [
      { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek V3 (Free)', description: 'Бесплатная мощная модель DeepSeek', isFree: true },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', description: 'Бесплатная модель от Meta', isFree: true },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', description: 'Экспериментальная бесплатная модель Google', isFree: true },
      { id: 'qwen/qwen-2.5-coder-32b-instruct:free', name: 'Qwen 2.5 Coder 32B (Free)', description: 'Бесплатная модель для кода', isFree: true },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (Платная, $0.14/1M)', description: 'Сверхбыстрый и дешевый флагман DeepSeek' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 Reasoning', description: 'Рассуждающая модель уровня o1' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'Быстрая и доступная модель OpenAI' },
      { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', description: 'Новейший быстрый Claude от Anthropic' },
    ],
  },
  gemini: {
    name: 'Google Gemini',
    description: 'Официальный прямой API Google Gemini (AI Studio).',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-1.5-flash',
    keyPlaceholder: 'AIzaSy...',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Быстрая, мультимодальная и сбалансированная' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Новейшее второе поколение Gemini' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Продвинутая модель для сложных задач' },
    ],
  },
  deepseek: {
    name: 'DeepSeek (Official)',
    description: 'Официальный API DeepSeek с прямым биллингом.',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    defaultModel: 'deepseek-chat',
    keyPlaceholder: 'sk-...',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3 (Chat)', description: 'Основная универсальная модель' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (Reasoner)', description: 'Глубокие рассуждения и логика' },
    ],
  },
  openai: {
    name: 'OpenAI (ChatGPT)',
    description: 'Официальный API от OpenAI.',
    docsUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o-mini',
    keyPlaceholder: 'sk-...',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Быстрая, экономичная модель' },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Флагманский мультимодальный интеллект' },
    ],
  },
  custom: {
    name: 'Свой сервер / Ollama',
    description: 'Локальная модель (Ollama, vLLM, LM Studio) или кастомный OpenAI-совместимый прокси.',
    docsUrl: '',
    defaultModel: 'llama3.3',
    keyPlaceholder: 'Ключ (если требуется)...',
    models: [
      { id: 'llama3.3', name: 'Llama 3.3', description: 'Локальная модель' },
      { id: 'deepseek-r1:14b', name: 'DeepSeek R1 14B', description: 'Локальная модель' },
      { id: 'qwen2.5:14b', name: 'Qwen 2.5 14B', description: 'Локальная модель' },
    ],
  },
};

const STORAGE_KEY_CONFIG = 'mcp_user_llm_config_v2';
const LEGACY_STORAGE_GEMINI = 'mcp_user_gemini_api_key';

export function getStoredLlmConfig(): UserLlmConfig | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.apiKey) return parsed;
    }
  } catch {}

  // Fallback to legacy Gemini key if present
  const legacyGemini = localStorage.getItem(LEGACY_STORAGE_GEMINI);
  if (legacyGemini && legacyGemini.trim()) {
    return {
      provider: 'gemini',
      apiKey: legacyGemini.trim(),
      model: 'gemini-1.5-flash',
    };
  }

  return null;
}

export function storeLlmConfig(config: UserLlmConfig): void {
  if (typeof window === 'undefined') return;
  if (!config.apiKey.trim()) {
    localStorage.removeItem(STORAGE_KEY_CONFIG);
    localStorage.removeItem(LEGACY_STORAGE_GEMINI);
  } else {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    if (config.provider === 'gemini') {
      localStorage.setItem(LEGACY_STORAGE_GEMINI, config.apiKey.trim());
    } else {
      localStorage.removeItem(LEGACY_STORAGE_GEMINI);
    }
  }
}

export function clearLlmConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_CONFIG);
  localStorage.removeItem(LEGACY_STORAGE_GEMINI);
}
