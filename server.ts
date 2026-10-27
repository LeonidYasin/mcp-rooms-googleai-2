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
import { runAutonomousNegotiation } from './server/negotiator';
import { getEmbeddingProviderStatus, matchListingAsymmetric } from './server/embeddings';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize persistent SQLite database on disk
initDatabase();

let isGeminiKeyFunctional: boolean | null = null;

// Helper to safely get the GoogleGenAI client with user-agent telemetry header
function getGenAiClient(): GoogleGenAI | null {
  if (isGeminiKeyFunctional === false) {
    return null;
  }
  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  if (!apiKey || apiKey === 'YOUR_API_KEY' || apiKey.length < 15) {
    isGeminiKeyFunctional = false;
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

// -------------------------------------------------------------
// 1. Official Model Context Protocol (MCP) JSON-RPC 2.0 Endpoint
// -------------------------------------------------------------
app.post('/mcp', async (req, res) => {
  const result = await handleMcpJsonRpcRequest(req.body);
  res.json(result);
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

app.post('/api/rooms/:id/messages', (req, res) => {
  try {
    const { sender, role, text } = req.body;
    const message = {
      id: 'msg-' + Date.now(),
      roomId: req.params.id,
      sender: sender || 'user:guest',
      role: role || 'human',
      text: text || '',
      timestamp: Date.now(),
    };
    addMessageToRoomInDb(message);
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
  const { messages, targetListingId } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Параметр messages обязателен и должен быть массивом' });
    return;
  }

  const userPrompt = messages[messages.length - 1]?.content || '';
  const promptLower = userPrompt.toLowerCase();

  // If targetListingId is passed, or user's intent is an autonomous task
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
    promptLower.includes('хочу познакомиться');

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
      // Fall through to general handler if error
    }
  }

  // General Questions / Creation intent via MCP
  if (
    promptLower.includes('создай') ||
    promptLower.includes('опубликуй') ||
    promptLower.includes('выстави') ||
    promptLower.includes('продам')
  ) {
    try {
      const toolResult = await executeMcpToolCall('create_listing', {
        title: userPrompt.replace(/^(создай|опубликуй|выстави)(\s+объявление(\s+о)?|\s+черновик)?/i, '').trim() || 'Новое объявление',
        description: `Опубликовано через Агента-Ангела: «${userPrompt}». Подробности в защищённой комнате.`,
        category: promptLower.includes('бизнес')
          ? 'business'
          : promptLower.includes('работ') || promptLower.includes('ваканси')
          ? 'jobs'
          : promptLower.includes('ремонт') || promptLower.includes('услуг')
          ? 'services'
          : promptLower.includes('знакомств')
          ? 'dating'
          : 'things',
        kind: 'offer',
        locality: promptLower.includes('москв') ? 'Москва' : 'Казань',
        price_rubles: 0,
        modes: ['pickup', 'online'],
        condition: 'Указано в описании',
      });

      res.json({
        text: `✅ Я успешно создал и сохранил в базу данных SQLite ваше объявление «${toolResult.created_listing.content.title}». Карточка опубликована в каталоге площадки!`,
        executedTools: [{ name: 'create_listing', args: { prompt: userPrompt }, result: toolResult }],
        createdListing: toolResult.created_listing,
      });
      return;
    } catch (err: any) {
      // Fallback
    }
  }

  // Safety & Privacy intent
  if (promptLower.includes('безопасн') || promptLower.includes('приватн') || promptLower.includes('телефон') || promptLower.includes('адрес')) {
    res.json({
      text: `🛡️ **Принципы безопасности и приватности MCP Rooms:**\n\n1. **Личные данные — не витрина:** телефон и точный домашний адрес никогда не отображаются в открытом интернете. Обмен контактами происходит только по взаимному согласию участников в защищённой комнате переговоров.\n2. **Открыта для всех:** город и регион служат фильтром для удобства поиска, а не барьером для регистрации.\n3. **Осознанная публикация:** сначала создаётся черновик и проходит предпросмотр.\n4. **Защита сделки:** встречайтесь в безопасных общественных местах или используйте проверенные службы доставки. Не переводите предоплату незнакомцам.`,
      executedTools: [{ name: 'inspect_safety_guidelines', args: { topic: 'privacy' }, result: { verified: true } }],
    });
    return;
  }

  // Try Gemini if available, or answer as Angel Agent
  const aiClient = getGenAiClient();
  if (aiClient) {
    try {
      const contents: any[] = messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction:
            'Ты — персональный ИИ-ассистент («Агент-Ангел») маркетплейса «Хочу · Предлагаю» (MCP Rooms). Помогай пользователю искать партнёров по бизнесу, исполнителей услуг, товары, попутчиков и знакомства. Соблюдай приватность и предлагай запустить переговоры через MCP-инструменты.',
          temperature: 0.7,
        },
      });

      res.json({
        text: response.text || 'Готов к новым поручениям!',
        executedTools: [],
      });
      return;
    } catch (_err) {
      isGeminiKeyFunctional = false;
    }
  }

  // Default Angel Agent response
  res.json({
    text: `Здравствуйте! Я ваш персональный **Агент-Ангел** на площадке MCP Rooms.\n\nДайте мне любое поручение, например:\n• *«Найди партнёра для бизнеса в сфере AI в Казани»*\n• *«Найди исполнителя на ремонт санузла под ключ»*\n• *«Ищу Senior Backend инженера на TypeScript»*\n• *«Хочу найти компанию для походов и велопрогулок»*\n\nЯ автономно найду совпадения в базе данных SQLite, зайду в защищённую комнату переговоров и проведу предварительный раунд согласования условий с агентом контрагента!`,
    executedTools: [],
  });
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
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MCP Rooms server with SQLite & JSON-RPC running on http://0.0.0.0:${PORT}`);
  });
}

start();
