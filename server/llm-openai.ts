import { logger } from './logger';

export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface OpenAiToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface CallOpenAiParams {
  apiKey: string;
  baseUrl?: string;
  model: string;
  messages: OpenAiMessage[];
  systemInstruction?: string;
  tools?: any[];
  temperature?: number;
  providerName?: string;
}

export interface CallOpenAiResult {
  text: string;
  toolCalls: OpenAiToolCall[];
  rawMessage: any;
  model: string;
}

export const OPENAI_MCP_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_listings',
      description:
        'Ищет активные объявления и предложения на площадке MCP Rooms по ключевым словам, категориям (business, jobs, services, real_estate, communities, things, dating, rides, delivery), типу и городу.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Поисковый запрос (например: коворкинг, офис, аренда, ремонт, вакансия)',
          },
          category: {
            type: 'string',
            description:
              'Категория: business, jobs, services, real_estate, communities, things, dating, rides, delivery, other, all',
          },
          kind: { type: 'string', description: 'Тип: offer (предлагаю), request (хочу/ищу), all' },
          locality: { type: 'string', description: 'Город (например: Казань, Москва)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'match_listings',
      description:
        'Асимметричный семантический матчинг: сопоставляет запрос «Хочу» с подходящими предложениями «Предлагаю».',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Текст задачи, описания или поисковой интенции' },
          query_kind: { type: 'string', description: 'request (ищу/хочу) или offer (предлагаю)' },
          category: { type: 'string', description: 'Категория' },
          locality: { type: 'string', description: 'Город' },
          limit: { type: 'number', description: 'Лимит результатов (по умолчанию 5)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_listing',
      description:
        'Создаёт и сохраняет новое объявление или черновик в постоянную базу данных SQLite на площадке MCP Rooms.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Название объявления' },
          description: { type: 'string', description: 'Подробное описание и требования' },
          category: {
            type: 'string',
            description:
              'Категория: business, jobs, services, real_estate, communities, things, dating, rides, delivery, other',
          },
          kind: { type: 'string', description: 'Тип: offer (предлагаю) или request (хочу/ищу)' },
          locality: { type: 'string', description: 'Город' },
          price_rubles: { type: 'number', description: 'Цена в рублях (0 для договорной)' },
        },
        required: ['title', 'description', 'category', 'kind', 'locality'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'negotiate_agreement',
      description:
        'Возвращает демонстрационный сценарий переговоров по объявлению (demo_preview). Не отправляет сообщения автору и не создаёт комнату.',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'Поручение пользователя или цель переговоров' },
          target_listing_id: { type: 'string', description: 'ID целевого объявления (если известно)' },
        },
        required: ['goal'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_room_history',
      description: 'Получает историю сообщений комнаты переговоров по room_id.',
      parameters: {
        type: 'object',
        properties: {
          room_id: { type: 'string', description: 'Идентификатор комнаты переговоров' },
        },
        required: ['room_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_profile',
      description: 'Получает публичный профиль пользователя или компании по profile_id.',
      parameters: {
        type: 'object',
        properties: {
          profile_id: { type: 'string', description: 'ID профиля (например user:founder-alex)' },
        },
        required: ['profile_id'],
      },
    },
  },
];

/**
 * Resolves standard completion endpoint URL based on provider.
 */
export function resolveProviderEndpoint(provider: string, customBaseUrl?: string): string {
  if (customBaseUrl) {
    const trimmed = customBaseUrl.replace(/\/+$/, '');
    if (trimmed.endsWith('/chat/completions')) return trimmed;
    return `${trimmed}/chat/completions`;
  }

  switch (provider.toLowerCase()) {
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions';
    case 'deepseek':
      return 'https://api.deepseek.com/chat/completions';
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'groq':
      return 'https://api.groq.com/openai/v1/chat/completions';
    default:
      return 'https://openrouter.ai/api/v1/chat/completions';
  }
}

/**
 * Executes a call to any OpenAI-compatible Chat Completions API
 * (OpenRouter, DeepSeek, OpenAI, Groq, local Ollama/vLLM).
 */
export async function callOpenAiCompatibleLlm(params: CallOpenAiParams): Promise<CallOpenAiResult> {
  const provider = params.providerName || 'openrouter';
  const endpoint = resolveProviderEndpoint(provider, params.baseUrl);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${params.apiKey.trim()}`,
  };

  if (endpoint.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = 'https://leonid-mcp.duckdns.org';
    headers['X-Title'] = 'MCP Rooms Marketplace (Angel Agent)';
  }

  const messagesToSend = [...params.messages];
  if (params.systemInstruction) {
    if (messagesToSend.length === 0 || messagesToSend[0].role !== 'system') {
      messagesToSend.unshift({
        role: 'system',
        content: params.systemInstruction,
      });
    }
  }

  const payload: any = {
    model: params.model,
    messages: messagesToSend,
    temperature: params.temperature ?? 0.7,
  };

  if (params.tools && params.tools.length > 0) {
    payload.tools = params.tools;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errorBody);
    } catch {
      parsed = { message: errorBody };
    }
    const errMessage = parsed?.error?.message || errorBody || `HTTP ${response.status}`;
    const error = new Error(`${provider.toUpperCase()} API Error (${response.status}): ${errMessage}`);
    (error as any).status = response.status;
    (error as any).raw = parsed;
    throw error;
  }

  const data: any = await response.json();
  const choice = data.choices?.[0];
  const message = choice?.message || {};

  const toolCalls: OpenAiToolCall[] = [];
  if (message.tool_calls && Array.isArray(message.tool_calls)) {
    for (const tc of message.tool_calls) {
      if (tc.type === 'function' && tc.function?.name) {
        let parsedArgs: Record<string, any> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments || '{}');
        } catch {
          parsedArgs = {};
        }
        toolCalls.push({
          id: tc.id || `call-${Date.now()}`,
          name: tc.function.name,
          args: parsedArgs,
        });
      }
    }
  }

  return {
    text: message.content || '',
    toolCalls,
    rawMessage: message,
    model: data.model || params.model,
  };
}

/**
 * End-to-end multi-turn chat execution with autonomous MCP tool calling loop
 * for OpenRouter, DeepSeek, OpenAI, etc.
 */
export async function executeOpenAiChatWithMcp(params: {
  apiKey: string;
  baseUrl?: string;
  model: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  systemInstruction?: string;
  providerName?: string;
  principalId: string;
  executeTool: (name: string, args: any, ctx: any) => Promise<any>;
}): Promise<{
  text: string;
  model: string;
  executedTools: any[];
  negotiationResult: any;
  createdListingResult: any;
}> {
  const openAiMessages: OpenAiMessage[] = params.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const initialResponse = await callOpenAiCompatibleLlm({
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    model: params.model,
    messages: openAiMessages,
    systemInstruction: params.systemInstruction,
    tools: OPENAI_MCP_TOOLS,
    providerName: params.providerName,
  });

  if (initialResponse.toolCalls && initialResponse.toolCalls.length > 0) {
    const executedToolsLog: any[] = [];
    let negotiationResult: any = null;
    let createdListingResult: any = null;
    const toolResultMessages: OpenAiMessage[] = [];

    for (const call of initialResponse.toolCalls) {
      try {
        const result = await params.executeTool(call.name, call.args, {
          principalId: params.principalId,
        });
        executedToolsLog.push({ name: call.name, args: call.args, result });

        if (call.name === 'negotiate_agreement' && result?.success) {
          negotiationResult = result;
        }
        if (call.name === 'create_listing' && result?.created_listing) {
          createdListingResult = result.created_listing;
        }

        toolResultMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      } catch (err: any) {
        toolResultMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ error: err.message }),
        });
      }
    }

    const followUpMessages: OpenAiMessage[] = [
      ...openAiMessages,
      initialResponse.rawMessage,
      ...toolResultMessages,
    ];

    const followUpResponse = await callOpenAiCompatibleLlm({
      apiKey: params.apiKey,
      baseUrl: params.baseUrl,
      model: params.model,
      messages: followUpMessages,
      systemInstruction: params.systemInstruction,
      providerName: params.providerName,
    });

    return {
      text: followUpResponse.text || 'Действие успешно выполнено через протокол MCP.',
      model: followUpResponse.model || params.model,
      executedTools: executedToolsLog,
      negotiationResult,
      createdListingResult,
    };
  }

  return {
    text: initialResponse.text,
    model: initialResponse.model,
    executedTools: [],
    negotiationResult: null,
    createdListingResult: null,
  };
}
