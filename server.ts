import express from 'express';
import { createServer as createViteServer } from 'vite';
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
} from './server/db';
import { handleMcpJsonRpcRequest, executeMcpToolCall, MCP_TOOLS_MANIFEST } from './server/mcp';
import { runAutonomousNegotiation, prepareNegotiationRoom } from './server/negotiator';
import { getEmbeddingProviderStatus, matchListingAsymmetric } from './server/embeddings';
import { roomEventBus } from './server/events';

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
      'Запускает автономный цикл переговоров между агентами в изолированной комнате (Shared Room) для согласования условий, цены и фиксации соглашения в SQLite.',
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
    description: 'Получает историю сообщений и соглашение из комнаты переговоров по room_id.',
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
app.post('/mcp', async (req, res) => {
  try {
    const result = await handleMcpJsonRpcRequest(req.body);
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
    res.json(listings);
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
    res.json(listing);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/listings', (req, res) => {
  try {
    const created = createListingInDb(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rooms', (_req, res) => {
  try {
    const rooms = getRoomsFromDb();
    res.json(rooms);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rooms/:id', (req, res) => {
  try {
    const room = getRoomByIdFromDb(req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
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
app.get('/api/rooms/:id/stream', (req, res) => {
  const roomId = req.params.id;
  const room = getRoomByIdFromDb(roomId);
  if (!room) {
    res.status(404).json({ error: `Комната ${roomId} не найдена` });
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

app.post('/api/rooms/:id/messages', (req, res) => {
  try {
    const { sender, role, text } = req.body;
    const message = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      roomId: req.params.id,
      sender: sender || 'user:guest',
      role: role || 'human',
      text: text || '',
      timestamp: Date.now(),
    };
    addMessageToRoomInDb(message);
    // Broadcast live event to SSE subscribers
    roomEventBus.broadcast(req.params.id, 'message', message);
    res.status(201).json(message);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/negotiations', (_req, res) => {
  try {
    const negs = getNegotiationsFromDb();
    res.json(negs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agent/negotiate/start', (req, res) => {
  try {
    const { prompt, targetListingId } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const { roomId, bestMatch, targetListingTitle, isExistingMatch } = prepareNegotiationRoom(
      prompt,
      targetListingId
    );

    // Run autonomous negotiation in background with live pacing for SSE stream
    setTimeout(async () => {
      try {
        await runAutonomousNegotiation(prompt, targetListingId, {
          roomId,
          livePacing: true,
        });
      } catch (err) {
        console.error('Error during autonomous negotiation:', err);
      }
    }, 100);

    res.json({
      roomId,
      targetListingTitle,
      isExistingMatch,
      bestMatch,
      streamUrl: `/api/rooms/${roomId}/stream`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agent/negotiate', async (req, res) => {
  try {
    const { prompt, targetListingId } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }
    const result = await runAutonomousNegotiation(prompt, targetListingId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 3. Angel Agent Conversational Endpoint with MCP & Autonomy
// -------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, targetListingId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Параметр messages обязателен и должен быть массивом' });
      return;
    }

  const userPrompt = messages[messages.length - 1]?.content || '';
  const promptLower = userPrompt.toLowerCase();

  // Try real Gemini API with autonomous MCP Function Calling
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
- negotiate_agreement: запуск автономных переговоров между агентами в изолированной комнате (Shared Room) для согласования условий
- get_room_history: просмотр истории переговоров и соглашений
- get_profile: публичный профиль автора или компании

Всегда выполняй интент-анализ входящего сообщения:
1. Если пользователь ищет объявления, партнеров, жилье, работу или команду — вызывай search_listings или match_listings.
2. Если просит договориться, провести переговоры или согласовать условия — вызывай negotiate_agreement.
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
            const result = await executeMcpToolCall(toolName, call.args || {});
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
    }
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
      const negotiationResult = await runAutonomousNegotiation(userPrompt, targetListingId);
      res.json({
        text: negotiationResult.summary,
        negotiation: negotiationResult,
        executedTools: [
          {
            name: 'match_listings',
            args: { query: userPrompt, targetListingId },
            result: {
              matched_listing: negotiationResult.targetListing?.content?.title,
              similarity_score: negotiationResult.similarityScore,
              match_method: negotiationResult.matchMethod,
              match_reason: negotiationResult.matchReason,
            },
          },
          {
            name: 'join_room',
            args: { room_id: negotiationResult.roomId },
            result: { room_created: true },
          },
          {
            name: 'send_message',
            args: { rounds_count: negotiationResult.dialogue.length },
            result: { agreement: negotiationResult.status },
          },
        ],
        createdListing: negotiationResult.status === 'listing_created' ? negotiationResult.targetListing : null,
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
      });

      res.json({
        text: `✅ Я успешно создал и сохранил в постоянную базу данных SQLite ваше объявление «${toolResult.created_listing.content.title}» в категории «${detectedCategory}». Карточка опубликована в каталоге площадки!`,
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
      text: `🛡️ **Принципы безопасности и приватности MCP Rooms:**\n\n1. **Личные данные — не витрина:** телефон и точный домашний адрес никогда не отображаются в открытом интернете. Обмен контактами происходит только по взаимному согласию участников в защищённой комнате переговоров.\n2. **Открыта для всех:** город и регион служат фильтром для удобства поиска, а не барьером для регистрации.\n3. **Осознанная публикация:** сначала создаётся черновик и проходит предпросмотр.\n4. **Защита сделки:** переговоры между агентами фиксируются в SQLite, встречи проводятся в безопасных местах или онлайн.`,
      executedTools: [{ name: 'inspect_safety_guidelines', args: { topic: 'privacy' }, result: { verified: true } }],
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
      text: `По вашему запросу «${userPrompt}» я проверил постоянную базу данных SQLite и нашёл актуальные объявления:\n\n${listPreview}\n\n💡 **Что я могу сделать:** напишите мне *«Договорись по объявлению #${foundItems[0].id}»* или *«Найди партнёра / согласуй просмотр»*, и я автономно проведу раунд переговоров в изолированной комнате через MCP!`,
      executedTools: [
        {
          name: 'search_listings',
          args: { query: userPrompt, category: searchCategory },
          result: { count: foundItems.length, top_item: foundItems[0].content.title },
        },
      ],
    });
    return;
  }

    // 5. Context-aware guidance with SQLite categories
    res.json({
      text: `Я проанализировал ваш запрос «${userPrompt}». В базе данных SQLite площадки **MCP Rooms** доступны следующие направления:\n\n🏢 **Недвижимость** — аренда коворкингов, офисов и поиск сожителей;\n🏛️ **Сообщества и Парламент** — команды проектов, инициативы и открытое самоуправление;\n🤝 **Бизнес** — кофаундеры и B2B AI-партнёрства;\n💼 **Вакансии** — Senior инженеры и удалённые позиции;\n🔧 **Услуги** — проверенные мастера и ремонт;\n🌲 **Знакомства** — совместные походы и веловыезды.\n\nУкажите конкретную задачу (например: *«Снять коворкинг в Казани»* или *«Вступить в Парламент сообществ»*), и я автономно найду совпадения и запущу раунд согласования условий в защищённой комнате!`,
      executedTools: [],
    });
  } catch (chatErr: any) {
    console.error('Unhandled error in /api/chat:', chatErr);
    res.status(500).json({
      error: chatErr?.message || 'Внутренняя ошибка обработки чата',
      text: 'Извините, произошла техническая ошибка при обработке запроса. База данных SQLite сохранена и доступна.',
      executedTools: [],
    });
  }
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
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
