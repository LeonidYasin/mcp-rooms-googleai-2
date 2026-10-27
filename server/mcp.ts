import {
  getListingsFromDb,
  getListingByIdFromDb,
  createListingInDb,
  getRoomsFromDb,
  getRoomByIdFromDb,
  createRoomInDb,
  addMessageToRoomInDb,
  getProfilesFromDb,
  getProfileByIdFromDb,
} from './db';
import {
  matchListingAsymmetric,
  getEmbeddingProviderStatus,
} from './embeddings';
import { runAutonomousNegotiation } from './negotiator';

// Definitions of Model Context Protocol (MCP) Tools
export const MCP_TOOLS_MANIFEST = [
  {
    name: 'search_listings',
    description:
      'Ищет активные объявления и предложения на площадке MCP Rooms по ключевым словам, категориям (business, jobs, services, things, dating, rides, delivery), типу и городу.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Поисковый запрос (например: кофаундер, ремонт, велосипед)' },
        category: {
          type: 'string',
          enum: ['business', 'jobs', 'services', 'real_estate', 'communities', 'things', 'dating', 'rides', 'delivery', 'other', 'all'],
          description: 'Категория объявления',
        },
        kind: { type: 'string', enum: ['offer', 'request', 'all'], description: 'Тип (предложение или запрос)' },
        locality: { type: 'string', description: 'Город (например: Казань, Москва)' },
      },
    },
  },
  {
    name: 'match_listings',
    description:
      'Асимметричный семантический матчинг (Google Embeddings с fallback): сопоставляет запрос «Хочу» (Request) одного пользователя с подходящими предложениями «Предлагаю» (Offer) другого пользователя.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Текст задачи, описания или поисковой интенции' },
        query_kind: { type: 'string', enum: ['request', 'offer'], description: 'Тип интенции: request (ищу/хочу) или offer (предлагаю)' },
        category: { type: 'string', description: 'Категория' },
        locality: { type: 'string', description: 'Город' },
        limit: { type: 'number', description: 'Максимальное количество результатов' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_profile',
    description: 'Получает публичный профиль пользователя или компании (репутация, верификация, специализация).',
    inputSchema: {
      type: 'object',
      properties: {
        profile_id: { type: 'string', description: 'Идентификатор профиля (например: user:founder-alex, org:alga-tech)' },
      },
      required: ['profile_id'],
    },
  },
  {
    name: 'get_embedding_status',
    description: 'Возвращает текущий статус провайдера эмбеддингов (Google Embeddings vs Fallback / Disabled).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_listing',
    description:
      'Создаёт и сохраняет новое объявление или черновик в постоянную базу данных SQLite на площадке MCP Rooms.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Название объявления' },
        description: { type: 'string', description: 'Подробное описание и требования' },
        category: {
          type: 'string',
          enum: ['business', 'jobs', 'services', 'real_estate', 'communities', 'things', 'dating', 'rides', 'delivery', 'other'],
          description: 'Категория',
        },
        kind: { type: 'string', enum: ['offer', 'request'], description: 'Тип: offer или request' },
        locality: { type: 'string', description: 'Город' },
        price_rubles: { type: 'number', description: 'Цена в рублях (0 для договорной)' },
        modes: { type: 'array', items: { type: 'string' }, description: 'Способы (pickup, shipping, online)' },
        condition: { type: 'string', description: 'Состояние / формат' },
      },
      required: ['title', 'description', 'category', 'kind', 'locality'],
    },
  },
  {
    name: 'join_room',
    description:
      'Создаёт или присоединяется к защищённой изолированной комнате переговоров (Shared Room) для обсуждения конкретного объявления.',
    inputSchema: {
      type: 'object',
      properties: {
        listing_id: { type: 'string', description: 'Идентификатор обсуждаемого объявления' },
        buyer_id: { type: 'string', description: 'Идентификатор пользователя или его агента' },
        initial_message: { type: 'string', description: 'Первичное обращение к контрагенту' },
      },
      required: ['listing_id', 'buyer_id'],
    },
  },
  {
    name: 'send_message',
    description: 'Отправляет сообщение или аргумент переговоров в защищённую комнату переговоров.',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string', description: 'Идентификатор комнаты переговоров' },
        sender: { type: 'string', description: 'Имя или ID отправителя (например agent:angel)' },
        role: { type: 'string', enum: ['agent', 'human', 'system'], description: 'Роль отправителя' },
        text: { type: 'string', description: 'Текст сообщения' },
      },
      required: ['room_id', 'sender', 'text'],
    },
  },
  {
    name: 'get_room_history',
    description: 'Получает полную историю сообщений и статус переговорной комнаты из базы данных SQLite.',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string', description: 'Идентификатор комнаты' },
      },
      required: ['room_id'],
    },
  },
  {
    name: 'negotiate_agreement',
    description:
      'Запускает автономный цикл переговоров (Multi-Agent Negotiation Loop) между агентом-инициатором и агентом-контрагентом в изолированной комнате для согласования условий, цены и фиксации соглашения в SQLite.',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'Поручение пользователя или цель переговоров' },
        target_listing_id: { type: 'string', description: 'Идентификатор целевого объявления (если известно)' },
      },
      required: ['goal'],
    },
  },
];

// Execute MCP Tool directly against the SQLite database
export async function executeMcpToolCall(name: string, args: any): Promise<any> {
  switch (name) {
    case 'match_listings': {
      const candidates = getListingsFromDb({
        category: args.category,
        locality: args.locality,
      });

      const matches = await matchListingAsymmetric(args.query, candidates, {
        queryKind: args.query_kind,
        category: args.category,
        locality: args.locality,
        limit: args.limit || 5,
      });

      return {
        query: args.query,
        query_kind: args.query_kind || 'request',
        embedding_status: getEmbeddingProviderStatus(),
        matches_count: matches.length,
        matches: matches.map((m) => ({
          id: m.listing.id,
          title: m.listing.content.title,
          category: m.listing.content.category,
          kind: m.listing.content.kind,
          author: m.listing.author_name,
          locality: m.listing.content.locality,
          price_rub: m.listing.content.price_minor ? m.listing.content.price_minor / 100 : 'Договорная',
          similarity_score: m.similarityScore,
          similarity_percent: `${Math.round(m.similarityScore * 100)}%`,
          match_method: m.matchMethod,
          match_reason: m.matchReason,
        })),
      };
    }

    case 'get_profile': {
      const profile = getProfileByIdFromDb(args.profile_id);
      if (!profile) {
        return { error: `Профиль ${args.profile_id} не найден` };
      }
      return { profile };
    }

    case 'get_embedding_status': {
      return getEmbeddingProviderStatus();
    }

    case 'search_listings': {
      const items = getListingsFromDb({
        category: args.category,
        kind: args.kind,
        locality: args.locality,
        query: args.query,
      });

      return {
        total_found: items.length,
        items: items.map((l) => ({
          id: l.id,
          title: l.content.title,
          category: l.content.category,
          subcategory: l.content.subcategory,
          kind: l.content.kind,
          locality: l.content.locality,
          price_rub: l.content.price_minor ? l.content.price_minor / 100 : 'Договорная',
          modes: l.content.modes,
          author: l.author_name,
          description: l.content.description.substring(0, 160) + '...',
        })),
      };
    }

    case 'create_listing': {
      const priceMinor =
        args.price_rubles && args.price_rubles > 0
          ? Math.floor(args.price_rubles * 100)
          : null;

      const newListing = {
        id: 'listing-' + Date.now(),
        owner: 'user:agent-angel',
        author_name: args.author_name || 'Агент-Ангел (по поручению пользователя)',
        content: {
          title: args.title,
          description: args.description,
          category: args.category || 'things',
          subcategory: args.subcategory || undefined,
          kind: args.kind || 'offer',
          modes: args.modes || ['pickup', 'online'],
          locality: args.locality || 'Казань',
          price_minor: priceMinor,
          currency: 'RUB',
          condition: args.condition || 'Указано в описании',
        },
        status: 'active',
        visibility: 'public',
        revision: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
        expires_at: Date.now() + 3600000 * 24 * 90,
        photos: [],
        responses_count: 0,
      };

      const created = createListingInDb(newListing);
      return {
        success: true,
        message: 'Объявление успешно сохранено в SQLite и опубликовано',
        created_listing: created,
      };
    }

    case 'join_room': {
      const listing = getListingByIdFromDb(args.listing_id);
      if (!listing) {
        return { error: `Объявление ${args.listing_id} не найдено` };
      }

      // Check if room already exists for this listing and buyer
      const rooms = getRoomsFromDb();
      let room: any = rooms.find(
        (r) => r.listingId === args.listing_id && r.participants.includes(args.buyer_id)
      );

      if (!room) {
        const roomId = `room-${args.listing_id}-${Date.now().toString(36).substring(4)}`;
        room = createRoomInDb({
          id: roomId,
          listingId: listing.id,
          listingTitle: listing.content.title,
          participants: [args.buyer_id, listing.owner, 'agent:counterpart', 'agent:angel'],
        });

        if (args.initial_message) {
          addMessageToRoomInDb({
            id: 'msg-' + Date.now(),
            roomId,
            sender: args.buyer_id,
            role: 'agent',
            text: args.initial_message,
            timestamp: Date.now(),
          });
        }
      }

      const roomId = room?.id || `room-${args.listing_id}`;
      return {
        success: true,
        room_id: roomId,
        listing_id: listing.id,
        listing_title: listing.content.title,
        counterpart_owner: listing.owner,
        room,
      };
    }

    case 'send_message': {
      const room = getRoomByIdFromDb(args.room_id);
      if (!room) {
        return { error: `Комната ${args.room_id} не найдена` };
      }

      const msg = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        roomId: args.room_id,
        sender: args.sender,
        role: args.role || 'agent',
        text: args.text,
        timestamp: Date.now(),
      };

      addMessageToRoomInDb(msg);
      return { success: true, message: msg };
    }

    case 'get_room_history': {
      const room = getRoomByIdFromDb(args.room_id);
      if (!room) {
        return { error: `Комната ${args.room_id} не найдена` };
      }
      return {
        room_id: room.id,
        title: room.listingTitle,
        participants: room.participants,
        messages_count: room.messages.length,
        messages: room.messages,
      };
    }

    case 'negotiate_agreement': {
      const goal = args.goal || args.prompt || '';
      if (!goal) {
        return { error: 'Параметр goal обязателен' };
      }
      const negotiationResult = await runAutonomousNegotiation(goal, args.target_listing_id);
      return {
        success: true,
        negotiation_id: negotiationResult.negotiationId,
        status: negotiationResult.status,
        room_id: negotiationResult.roomId,
        target_listing: negotiationResult.targetListing?.content?.title,
        rounds_count: negotiationResult.dialogue.length,
        summary: negotiationResult.summary,
        agreed_terms: negotiationResult.agreedTerms,
        steps: negotiationResult.steps,
      };
    }

    default:
      throw new Error(`MCP Tool ${name} не поддерживается`);
  }
}

// JSON-RPC 2.0 Handler for external AI agents connecting to MCP server
export async function handleMcpJsonRpcRequest(rpcBody: any): Promise<any> {
  const { jsonrpc, id, method, params } = rpcBody;

  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id: id || null, error: { code: -32600, message: 'Invalid Request: expected jsonrpc 2.0' } };
  }

  try {
    switch (method) {
      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: MCP_TOOLS_MANIFEST,
          },
        };

      case 'tools/call': {
        const { name, arguments: toolArgs } = params || {};
        if (!name) {
          return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Missing tool name' } };
        }
        const toolResult = await executeMcpToolCall(name, toolArgs || {});
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(toolResult, null, 2),
              },
            ],
            data: toolResult,
          },
        };
      }

      case 'resources/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            resources: [
              {
                uri: 'listings://all',
                name: 'Active Marketplace Listings',
                mimeType: 'application/json',
              },
              {
                uri: 'rooms://all',
                name: 'Active Shared Rooms',
                mimeType: 'application/json',
              },
            ],
          },
        };

      case 'resources/read': {
        const { uri } = params || {};
        if (uri === 'listings://all') {
          const listings = getListingsFromDb({});
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(listings, null, 2) }],
            },
          };
        }
        if (uri === 'rooms://all') {
          const rooms = getRoomsFromDb();
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(rooms, null, 2) }],
            },
          };
        }
        return { jsonrpc: '2.0', id, error: { code: -32602, message: `Resource not found: ${uri}` } };
      }

      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
  } catch (err: any) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: err?.message || 'Server error executing MCP procedure' },
    };
  }
}
