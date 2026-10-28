import express from 'express';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import {
  initDatabase,
  getListingsFromDb,
  getListingByIdFromDb,
  createListingInDb,
  getRoomsFromDb,
  getRoomByIdFromDb,
  addMessageToRoomInDb,
  getNegotiationsFromDb,
  getProfilesFromDb,
  getProfileByIdFromDb,
  toPublicListing,
  classifyMessageInsertError,
} from './server/db';
import { handleMcpJsonRpcRequest, executeMcpToolCall, MCP_TOOLS_MANIFEST } from './server/mcp';
import { runAutonomousNegotiation } from './server/negotiator';
import { getEmbeddingProviderStatus, matchListingAsymmetric } from './server/embeddings';
import { roomEventBus } from './server/events';
import { isRoomParticipant, optionalAuth, requireAuth } from './server/auth';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize persistent SQLite database on disk
initDatabase();

// Track if current key is known to be rejected/invalid to avoid hammering failing API
let lastInvalidGeminiKey: string | null = null;
let lastInvalidKeyTimestamp = 0;

// Helper to safely get the GoogleGenAI client with user-agent telemetry header
function getGenAiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  if (!apiKey || apiKey === 'YOUR_API_KEY' || apiKey.length < 15) {
    return null;
  }
  if (lastInvalidGeminiKey === apiKey && Date.now() - lastInvalidKeyTimestamp < 30000) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Gemini Function Calling Tools Manifest
const mcpGeminiTools: FunctionDeclaration[] = [
  {
    name: 'search_listings',
    description:
      'Ищет активные объявления и предложения на площадке MCP Rooms по ключевым словам, категориям (business, jobs, services, real_estate, communities, things, dating, rides, delivery), типу и городу.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Поисковый запрос (например: коворкинг, офис, аренда, ремонт, вакансия)' },
        category: {
          type: Type.STRING,
          description: 'Категория: business, jobs, services, real_estate, communities, things, dating, rides, delivery, other, all',
        },
        kind: { type: Type.STRING, description: 'Тип: offer (предлагаю), request (хочу/ищу), all' },
        locality: { type: Type.STRING, description: 'Город (например: Казань, Москва)' },
      },
    },
  },
  {
    name: 'match_listings',
    description:
      'Асимметричный семантический матчинг: сопоставляет запрос «Хочу» (Request) с подходящими предложениями «Предлагаю» (Offer).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Текст задачи, описания или поисковой интенции' },
        query_kind: { type: Type.STRING, description: 'request (ищу/хочу) или offer (предлагаю)' },
        category: { type: Type.STRING, description: 'Категория' },
        locality: { type: Type.STRING, description: 'Город' },
        limit: { type: Type.NUMBER, description: 'Лимит результатов (по умолчанию 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_listing',
    description:
      'Создаёт и сохраняет новое объявление или черновик в постоянную базу данных SQLite на площадке MCP Rooms.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Название объявления' },
        description: { type: Type.STRING, description: 'Подробное описание и требования' },
        category: {
          type: Type.STRING,
          description: 'Категория: business, jobs, services, real_estate, communities, things, dating, rides, delivery, other',
        },
        kind: { type: Type.STRING, description: 'Тип: offer (предлагаю) или request (хочу/ищу)' },
        locality: { type: Type.STRING, description: 'Город' },
        price_rubles: { type: Type.NUMBER, description: 'Цена в рублях (0 для договорной)' },
      },
      required: ['title', 'description', 'category', 'kind', 'locality'],
    },
  },
  {
    name: 'negotiate_agreement',
    description:
      'Возвращает демонстрационный сценарий переговоров по объявлению (demo_preview). Не отправляет сообщения автору, не создаёт комнату и не фиксирует соглашение; для реального контакта используйте join_room и send_message.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        goal: { type: Type.STRING, description: 'Поручение пользователя или цель переговоров' },
        target_listing_id: { type: Type.STRING, description: 'ID целевого объявления (если известно)' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'get_room_history',
    description: 'Получает историю сообщений комнаты переговоров по room_id (только для участника).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        room_id: { type: Type.STRING, description: 'Идентификатор комнаты переговоров' },
      },
      required: ['room_id'],
    },
  },
  {
    name: 'get_profile',
    description: 'Получает публичный профиль пользователя или компании по profile_id.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        profile_id: { type: Type.STRING, description: 'ID профиля (например user:founder-alex, org:alga-tech)' },
      },
      required: ['profile_id'],
    },
  },
];

// -------------------------------------------------------------
// 1. Official Model Context Protocol (MCP) JSON-RPC 2.0 Endpoint
// -------------------------------------------------------------
// tools/list and the public listing resources are open, but anything that
// touches a room or writes data requires a key (audit F-01).
function mcpRequiresAuth(body: any): boolean {
  if (body?.method === 'tools/call') return true;
  if (body?.method === 'resources/read') {
    const uri = typeof body?.params?.uri === 'string' ? body.params.uri : '';
    return uri.startsWith('rooms://');
  }
  return false;
}

app.post('/mcp', optionalAuth, async (req, res) => {
  if (mcpRequiresAuth(req.body) && !req.principal) {
    res.status(401).json({
      jsonrpc: '2.0',
      id: req.body?.id ?? null,
      error: {
        code: -32001,
        message: 'Unauthorized: this MCP method requires Authorization: Bearer <token>',
      },
    });
    return;
  }
  try {
    const result = await handleMcpJsonRpcRequest(req.body, {
      principalId: req.principal?.principalId,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: { code: -32603, message: err?.message || 'Internal MCP server error' },
    });
  }
});

// -------------------------------------------------------------
// 2. Real REST API Endpoints with SQLite Persistence
// -------------------------------------------------------------
app.get('/api/embedding/status', (_req, res) => {
  try {
    const status = getEmbeddingProviderStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/match', async (req, res) => {
  try {
    const { query, query_kind, category, locality, limit } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Параметр query обязателен' });
      return;
    }
    const candidates = getListingsFromDb({ category, locality });
    const matches = await matchListingAsymmetric(query, candidates, {
      queryKind: query_kind,
      category,
      locality,
      limit: limit || 10,
    });
    res.json({
      query,
      query_kind: query_kind || 'request',
      embedding_status: getEmbeddingProviderStatus(),
      matches,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/profiles', (_req, res) => {
  try {
    const profiles = getProfilesFromDb();
    res.json(profiles);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/profiles/:id', (req, res) => {
  try {
    const profile = getProfileByIdFromDb(req.params.id);
    if (!profile) {
      res.status(404).json({ error: 'Профиль не найден' });
      return;
    }
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/listings', (req, res) => {
  try {
    const { category, kind, locality, query } = req.query as any;
    const listings = getListingsFromDb({ category, kind, locality, query });
    res.json(listings.map(toPublicListing));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/listings/:id', (req, res) => {
  try {
    const listing = getListingByIdFromDb(req.params.id);
    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }
    res.json(toPublicListing(listing));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Minimal input validation for the flat REST body. The full draft -> preview ->
// publish contract replaces this in PR-5; until then the endpoint must at least
// reject malformed input instead of writing garbage into SQLite.
const LISTING_CATEGORIES = [
  'business', 'jobs', 'services', 'real_estate', 'communities', 'things', 'dating', 'rides', 'delivery', 'other',
];
const LISTING_MODES = ['pickup', 'shipping', 'online'];

function normalizeListingInput(
  body: any,
  ownerPrincipalId: string
): { ok: true; listing: any } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  const title = text(body.title);
  const description = text(body.description);
  const category = text(body.category);
  const kind = text(body.kind);
  const locality = text(body.locality);

  if (title.length < 3 || title.length > 200) errors.push('title: 3..200 characters');
  if (description.length < 3 || description.length > 5000) errors.push('description: 3..5000 characters');
  if (!LISTING_CATEGORIES.includes(category)) errors.push(`category: one of ${LISTING_CATEGORIES.join(', ')}`);
  if (!['offer', 'request'].includes(kind)) errors.push('kind: offer|request');
  if (!locality) errors.push('locality: required');

  const priceRubles = body.price_rubles === undefined || body.price_rubles === null ? 0 : Number(body.price_rubles);
  if (!Number.isFinite(priceRubles) || priceRubles < 0) errors.push('price_rubles: non-negative number');

  const rawModes = body.modes === undefined ? ['pickup', 'online'] : body.modes;
  const modes = Array.isArray(rawModes) ? rawModes.filter((m: unknown) => LISTING_MODES.includes(String(m))) : [];
  if (!Array.isArray(rawModes) || modes.length !== rawModes.length) errors.push(`modes: subset of ${LISTING_MODES.join(', ')}`);

  if (errors.length > 0) return { ok: false, errors };

  const now = Date.now();
  return {
    ok: true,
    listing: {
      id: 'listing-' + now + '-' + Math.random().toString(36).substring(2, 8),
      owner: ownerPrincipalId,
      author_name: text(body.author_name) || ownerPrincipalId,
      content: {
        title,
        description,
        category,
        subcategory: text(body.subcategory) || undefined,
        kind,
        modes,
        locality,
        price_minor: priceRubles > 0 ? Math.floor(priceRubles * 100) : null,
        currency: 'RUB',
        condition: text(body.condition) || 'Указано в описании',
      },
      status: 'active',
      visibility: 'public',
      revision: 1,
      created_at: now,
      updated_at: now,
      expires_at: now + 3600000 * 24 * 90,
      photos: [],
      responses_count: 0,
    },
  };
}

app.post('/api/listings', requireAuth, (req, res) => {
  const principalId = req.principal!.principalId;
  const normalized = normalizeListingInput(req.body || {}, principalId);
  if (!normalized.ok) {
    res.status(422).json({ error: 'invalid_listing', errors: normalized.errors });
    return;
  }
  try {
    const created = createListingInDb(normalized.listing);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rooms', requireAuth, (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    // Only the rooms this key belongs to, never the whole table.
    const rooms = getRoomsFromDb().filter((room: any) => isRoomParticipant(room, principalId));
    res.json(rooms);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rooms/:id', requireAuth, (req, res) => {
  try {
    const roomId = String(req.params.id);
    const room = getRoomByIdFromDb(roomId);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    if (!isRoomParticipant(room, req.principal!.principalId)) {
      res.status(403).json({ error: 'forbidden', message: 'Вы не участник этой комнаты' });
      return;
    }
    res.json(room);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Server-Sent Events (SSE) Endpoint for Real-Time Room Streaming
// -------------------------------------------------------------
app.get('/api/rooms/:id/stream', requireAuth, (req, res) => {
  const roomId = String(req.params.id);
  const room = getRoomByIdFromDb(roomId);
  if (!room) {
    res.status(404).json({ error: `Комната ${roomId} не найдена` });
    return;
  }
  if (!isRoomParticipant(room, req.principal!.principalId)) {
    res.status(403).json({ error: 'forbidden', message: 'Вы не участник этой комнаты' });
    return;
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Client lastEventId for reconnection support
  const lastEventId = (req.headers['last-event-id'] as string) || '';

  // Current negotiation if exists
  const negs = getNegotiationsFromDb();
  const roomNeg = negs.find((n) => n.roomId === roomId) || null;

  // Send initial snapshot with all SQLite messages
  const initialPayload = {
    roomId: room.id,
    listingTitle: room.listingTitle,
    participants: room.participants,
    status: room.status,
    messages: room.messages, // All messages loaded directly from SQLite
    negotiation: roomNeg,
    serverTime: Date.now(),
    lastEventId,
  };

  res.write(`retry: 2500\n`);
  res.write(`id: init-${Date.now()}\n`);
  res.write(`event: init\n`);
  res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);

  // Subscribe to live room event bus
  const unsubscribe = roomEventBus.subscribe(roomId, (event) => {
    res.write(`id: ${event.id}\n`);
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);
  });

  // Heartbeat ping every 15s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

app.post('/api/rooms/:id/messages', requireAuth, (req, res) => {
  try {
    const roomId = String(req.params.id);
    const room = getRoomByIdFromDb(roomId);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const principalId = req.principal!.principalId;
    if (!isRoomParticipant(room, principalId)) {
      res.status(403).json({ error: 'forbidden', message: 'Вы не участник этой комнаты' });
      return;
    }
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      res.status(422).json({ error: 'invalid_message', message: 'text is required' });
      return;
    }

    // The sender is the authenticated principal: a client cannot post as someone else.
    const message = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      roomId,
      sender: principalId,
      role: req.body?.role === 'agent' ? 'agent' : 'human',
      text,
      timestamp: Date.now(),
    };
    // 201 only when the row was actually written. A concurrent delete of the
    // room, or a duplicate id, must not look like a successful post.
    try {
      addMessageToRoomInDb(message);
    } catch (err) {
      const reason = classifyMessageInsertError(err);
      if (reason === 'room_not_found') {
        res.status(404).json({ error: 'room_not_found', message: 'Room not found' });
        return;
      }
      if (reason === 'duplicate_message_id') {
        res.status(409).json({ error: 'duplicate_message_id' });
        return;
      }
      throw err;
    }
    // Broadcast live event to SSE subscribers
    roomEventBus.broadcast(roomId, 'message', message);
    res.status(201).json(message);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/negotiations', requireAuth, (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const visibleRoomIds = new Set(
      getRoomsFromDb()
        .filter((room: any) => isRoomParticipant(room, principalId))
        .map((room: any) => room.id)
    );
    const negs = getNegotiationsFromDb().filter((n: any) => visibleRoomIds.has(n.roomId));
    res.json(negs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agent/negotiate', requireAuth, async (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const { prompt, targetListingId } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }
    const result = await runAutonomousNegotiation(prompt, targetListingId, { principalId });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 3. Angel Agent Conversational Endpoint with MCP & Autonomy
// -------------------------------------------------------------
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const { messages, targetListingId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Параметр messages обязателен и должен быть массивом' });
      return;
    }

  const userPrompt = messages[messages.length - 1]?.content || '';
  const promptLower = userPrompt.toLowerCase();

  // Try real Gemini API with autonomous MCP Function Calling
  // Every response below declares whether a model was actually used: the UI must
  // never present rule-based answers as model-driven work.
  let llmDegradedReason: string | null = null;
  const aiClient = getGenAiClient();
  if (aiClient) {
    try {
      const systemInstruction = `Ты — персональный ИИ-ассистент («Агент-Ангел») автономной децентрализованной площадки объявлений «Хочу · Предлагаю» (MCP Rooms).
На площадке пользователи и их ИИ-агенты взаимодействуют по протоколу Model Context Protocol (MCP).
Категории площадки:
- real_estate: Недвижимость (аренда, коворкинги, жилье, квартиры, офисы, поиск сожителей)
- communities: Сообщества и команды (поиск единомышленников, проектные команды, Парламент сообществ, открытое самоуправление)
- business: Бизнес и партнерство (кофаундеры, инвестиции, B2B)
- jobs: Работа и вакансии (IT, разработка, резюме)
- services: Услуги и ремонт (сантехника, отделка, бытовые услуги)
- things: Вещи и товары (электроника, велосипеды, мебель)
- dating: Знакомства и хобби (спорт, походы, настольные игры)
- rides: Поездки и попутчики
- delivery: Доставка и курьеры

Доступные инструменты (MCP Tools):
- search_listings: поиск объявлений в постоянной базе данных SQLite
- match_listings: асимметричный семантический матчинг (Хочу <-> Предлагаю)
- create_listing: публикация нового объявления в базу данных SQLite
- negotiate_agreement: находит объявление и возвращает демонстрационный сценарий переговоров; ничего не отправляет автору и не фиксирует соглашение
- get_room_history: просмотр истории переговоров и соглашений
- get_profile: публичный профиль автора или компании

Всегда выполняй интент-анализ входящего сообщения:
1. Если пользователь ищет объявления, партнеров, жилье, работу или команду — вызывай search_listings или match_listings.
2. Если просит договориться или провести переговоры — вызывай negotiate_agreement, но всегда называй результат демонстрационным сценарием: комнату и реальные сообщения создаёт только пользователь через join_room/send_message.
3. Если просит создать или опубликовать объявление — вызывай create_listing.
4. Отвечай дружелюбно, структурированно, на русском языке, ссылайся на конкретные результаты из SQLite и предлагай следующий практический шаг.`;

      const contents: any[] = messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      // If explicit targetListingId is passed from card context, append context info
      if (targetListingId) {
        const targetListing = getListingByIdFromDb(targetListingId);
        if (targetListing) {
          contents[contents.length - 1].parts.push({
            text: `\n[Контекст карточки объявления: ID=${targetListing.id}, Название=«${targetListing.content.title}», Категория=${targetListing.content.category}, Автор=${targetListing.author_name}, Цена=${targetListing.content.price_minor ? targetListing.content.price_minor / 100 : 'Договорная'} ₽, Город=${targetListing.content.locality}]`,
          });
        }
      }

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
          tools: [{ functionDeclarations: mcpGeminiTools }],
        },
      });

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const executedToolsLog: any[] = [];
        let negotiationResult: any = null;
        let createdListingResult: any = null;
        const functionResponseParts: any[] = [];

        for (const call of functionCalls) {
          if (!call.name) continue;
          const toolName = call.name;
          try {
            const result = await executeMcpToolCall(toolName, call.args || {}, { principalId });
            executedToolsLog.push({ name: toolName, args: call.args, result });

            if (call.name === 'negotiate_agreement' && result?.success) {
              negotiationResult = result;
            }
            if (call.name === 'create_listing' && result?.created_listing) {
              createdListingResult = result.created_listing;
            }

            functionResponseParts.push({
              functionResponse: {
                name: call.name,
                response: { result },
              },
            });
          } catch (toolErr: any) {
            functionResponseParts.push({
              functionResponse: {
                name: call.name,
                response: { error: toolErr.message },
              },
            });
          }
        }

        const modelCandidate = response.candidates?.[0]?.content;
        const followUpContents = [
          ...contents,
          modelCandidate || { role: 'model', parts: [{ text: 'Вызываю MCP инструменты...' }] },
          {
            role: 'user',
            parts: functionResponseParts,
          },
        ];

        const followUpResponse = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: followUpContents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });

        res.json({
          text: followUpResponse.text || 'Действие успешно выполнено через протокол MCP.',
          executedTools: executedToolsLog,
          negotiation: negotiationResult,
          createdListing: createdListingResult,
        });
        return;
      }

      if (response.text) {
        res.json({
          text: response.text,
          executedTools: [],
        });
        return;
      }
    } catch (geminiError: any) {
      const errStr = String(geminiError?.message || geminiError);
      if (errStr.includes('API_KEY_INVALID') || errStr.includes('API key not valid')) {
        const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
        lastInvalidGeminiKey = apiKey;
        lastInvalidKeyTimestamp = Date.now();
      }
      console.warn('Gemini API call failed, switching to dynamic SQLite fallback:', errStr);
      llmDegradedReason = errStr;
    }
  }

  if (!llmDegradedReason) {
    llmDegradedReason = aiClient
      ? 'gemini returned no text for this prompt'
      : 'GEMINI_API_KEY is not configured';
  }

  // -----------------------------------------------------------------
  // Intelligent Dynamic Fallback (when API key is absent or quota limited)
  // Ensures user never receives a static canned template
  // -----------------------------------------------------------------

  // 1. Autonomous Negotiation Intent
  const isAutonomousTask =
    Boolean(targetListingId) ||
    promptLower.includes('найди') ||
    promptLower.includes('найти') ||
    promptLower.includes('подбери') ||
    promptLower.includes('договорись') ||
    promptLower.includes('согласуй') ||
    promptLower.includes('партнер') ||
    promptLower.includes('исполнитель') ||
    promptLower.includes('мастер') ||
    promptLower.includes('ваканси') ||
    promptLower.includes('купи') ||
    promptLower.includes('коворкинг') ||
    promptLower.includes('офис') ||
    promptLower.includes('квартир') ||
    promptLower.includes('сожител') ||
    promptLower.includes('парламент') ||
    promptLower.includes('сообществ') ||
    promptLower.includes('команд') ||
    promptLower.includes('познакомиться');

  if (isAutonomousTask) {
    try {
      const negotiationResult = await runAutonomousNegotiation(userPrompt, targetListingId, {
        principalId,
      });
      res.json({
        text:
          '⚠️ Демонстрационный сценарий (модель не вызывалась, автору ничего не отправлено).\n\n' +
          negotiationResult.summary,
        negotiation: negotiationResult,
        degraded: true,
        degradedReason: llmDegradedReason,
        executedTools: [
          {
            name: 'negotiate_agreement',
            args: { goal: userPrompt, target_listing_id: targetListingId ?? null },
            result: {
              room_id: negotiationResult.roomId,
              status: negotiationResult.status,
              rounds: negotiationResult.dialogue.length,
              target_listing: negotiationResult.targetListing?.content?.title ?? null,
            },
          },
        ],
        createdListing: null,
      });
      return;
    } catch {
      // Continue to other handlers
    }
  }

  // 2. Creation Intent via MCP
  if (
    promptLower.includes('создай') ||
    promptLower.includes('опубликуй') ||
    promptLower.includes('выстави') ||
    promptLower.includes('сдам') ||
    promptLower.includes('сниму') ||
    promptLower.includes('продам')
  ) {
    try {
      const detectedCategory = promptLower.includes('недвижим') || promptLower.includes('офис') || promptLower.includes('квартир') || promptLower.includes('аренд')
        ? 'real_estate'
        : promptLower.includes('сообществ') || promptLower.includes('парламент') || promptLower.includes('команд')
        ? 'communities'
        : promptLower.includes('бизнес')
        ? 'business'
        : promptLower.includes('работ') || promptLower.includes('ваканси')
        ? 'jobs'
        : promptLower.includes('ремонт') || promptLower.includes('услуг')
        ? 'services'
        : promptLower.includes('знакомств')
        ? 'dating'
        : 'things';

      const toolResult = await executeMcpToolCall('create_listing', {
        title: userPrompt.replace(/^(создай|опубликуй|выстави|сдам|сниму|продам)(\s+объявление(\s+о)?|\s+черновик)?/i, '').trim() || 'Новое объявление',
        description: `Опубликовано через Агента-Ангела: «${userPrompt}». Подробности и согласование в защищённой комнате MCP.`,
        category: detectedCategory,
        kind: promptLower.includes('сниму') || promptLower.includes('ищу') ? 'request' : 'offer',
        locality: promptLower.includes('москв') ? 'Москва' : 'Казань',
        price_rubles: 0,
        modes: ['pickup', 'online'],
        condition: 'Указано в описании',
      }, { principalId });

      res.json({
        text: `✅ Я успешно создал и сохранил в постоянную базу данных SQLite ваше объявление «${toolResult.created_listing.content.title}» в категории «${detectedCategory}». Карточка опубликована в каталоге площадки!`,
        degraded: true,
        degradedReason: llmDegradedReason,
        executedTools: [{ name: 'create_listing', args: { prompt: userPrompt }, result: toolResult }],
        createdListing: toolResult.created_listing,
      });
      return;
    } catch {
      // Fall through
    }
  }

  // 3. Safety & Privacy Intent
  if (promptLower.includes('безопасн') || promptLower.includes('приватн') || promptLower.includes('телефон') || promptLower.includes('адрес') || promptLower.includes('правил')) {
    res.json({
      text: `🛡️ **Что верно сейчас:** в карточках витрины нет телефонов и точных адресов — этих полей в объявлении нет вообще.

**Комнаты переговоров изолированы:** список комнат и историю видит только участник комнаты, сообщения пишутся от имени владельца ключа, а не из тела запроса. Участники комнаты — владелец объявления и тот, кто открыл переговоры.

**Чего пока нет:** ролей и scope у ключей (любой действующий ключ может многое), rate limiting и аудит-лога чтения комнат. Для SSE-потока токен передаётся в query-параметре и может попасть в логи прокси. Публикация идёт сразу, без модерации.

Поэтому не передавайте в комнату личные данные сверх необходимого: собеседник — реальный участник, а не демо-агент.`,
      degraded: true,
      degradedReason: llmDegradedReason,
      executedTools: [],
    });
    return;
  }

  // 4. Dynamic Search & Catalog Inspection in SQLite
  let searchCategory: string | undefined = undefined;
  if (promptLower.includes('недвижим') || promptLower.includes('аренд') || promptLower.includes('офис') || promptLower.includes('квартир') || promptLower.includes('жиль')) {
    searchCategory = 'real_estate';
  } else if (promptLower.includes('сообществ') || promptLower.includes('парламент') || promptLower.includes('команд') || promptLower.includes('инициатив')) {
    searchCategory = 'communities';
  } else if (promptLower.includes('бизнес') || promptLower.includes('стартап') || promptLower.includes('инвест')) {
    searchCategory = 'business';
  } else if (promptLower.includes('работ') || promptLower.includes('ваканси') || promptLower.includes('инженер')) {
    searchCategory = 'jobs';
  } else if (promptLower.includes('услуг') || promptLower.includes('ремонт') || promptLower.includes('мастер')) {
    searchCategory = 'services';
  }

  const foundItems = getListingsFromDb({
    category: searchCategory,
    query: searchCategory ? undefined : userPrompt,
  });

  if (foundItems.length > 0) {
    const listPreview = foundItems
      .slice(0, 3)
      .map(
        (item, idx) =>
          `${idx + 1}. **${item.content.title}** (${item.content.category})\n   📍 ${item.content.locality} · 💰 ${
            item.content.price_minor ? `${item.content.price_minor / 100} ₽` : 'Договорная'
          }\n   Автор: ${item.author_name} · *«${item.content.description.substring(0, 90)}...»*`
      )
      .join('\n\n');

    res.json({
      text: `По вашему запросу «${userPrompt}» я проверил постоянную базу данных SQLite и нашёл актуальные объявления:\n\n${listPreview}\n\n💡 **Что можно сделать:** откройте карточку и создайте комнату переговоров, чтобы написать автору. Запрос *«Договорись по объявлению #${foundItems[0].id}»* покажет только демонстрационный сценарий — автору ничего не отправится.`,
      executedTools: [
        {
          name: 'search_listings',
          args: { query: userPrompt, category: searchCategory },
          result: { count: foundItems.length, top_item: foundItems[0].content.title },
        },
      ],
      degraded: true,
      degradedReason: llmDegradedReason,
    });
    return;
  }

    // 5. Context-aware guidance with SQLite categories
    res.json({
      text: `Я проанализировал ваш запрос «${userPrompt}». В базе данных SQLite площадки **MCP Rooms** доступны следующие направления:\n\n🏢 **Недвижимость** — аренда коворкингов, офисов и поиск сожителей;\n🏛️ **Сообщества и Парламент** — команды проектов, инициативы и открытое самоуправление;\n🤝 **Бизнес** — кофаундеры и B2B AI-партнёрства;\n💼 **Вакансии** — Senior инженеры и удалённые позиции;\n🔧 **Услуги** — мастера и ремонт;\n🌲 **Знакомства** — совместные походы и веловыезды.\n\nУкажите конкретную задачу (например: *«Снять коворкинг в Казани»* или *«Вступить в Парламент сообществ»*), и я найду совпадения в каталоге.`,
      degraded: true,
      degradedReason: llmDegradedReason,
      executedTools: [],
    });
  } catch (chatErr: any) {
    console.error('Unhandled error in /api/chat:', chatErr);
    res.status(500).json({
      error: chatErr?.message || 'Внутренняя ошибка обработки чата',
      text: 'Извините, произошла техническая ошибка при обработке запроса. База данных SQLite сохранена и доступна.',
      degraded: true,
      executedTools: [],
    });
  }
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    // Vite is a dev dependency: import it lazily so the production image can be
    // built without devDependencies (see Dockerfile, `prod-deps` stage).
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    // Express 5 / path-to-regexp v8: bare '*' is invalid, use a named splat.
    app.get('/{*splat}', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MCP Rooms server with SQLite & JSON-RPC running on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

export { app, start };
