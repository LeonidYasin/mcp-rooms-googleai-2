import {
  addAuditLog,
  getListingsFromDb,
  getListingByIdFromDb,
  createListingInDb,
  publishListingInDb,
  withdrawListingInDb,
  getRoomsFromDb,
  getRoomByIdFromDb,
  createRoomInDb,
  addMessageToRoomInDb,
  getProfilesFromDb,
  getProfileByIdFromDb,
  toPublicListing,
  classifyMessageInsertError,
} from './db';
import {
  matchListingAsymmetric,
  getEmbeddingProviderStatus,
} from './embeddings';
import { runAutonomousNegotiation, generateReactiveAgentResponse } from './negotiator';
import { isRoomParticipant } from './auth';

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
      'Создаёт и сохраняет новое объявление в статусе черновика (draft) в базе данных SQLite.',
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
    name: 'preview_listing',
    description: 'Генерирует предпросмотр черновика и токен согласия (consent token) для последующей публикации.',
    inputSchema: {
      type: 'object',
      properties: {
        listing_id: { type: 'string', description: 'Идентификатор черновика объявления' },
      },
      required: ['listing_id'],
    },
  },
  {
    name: 'publish_listing',
    description: 'Публикует черновик объявления в каталог с явным токеном согласия и проверкой CAS-ревизии.',
    inputSchema: {
      type: 'object',
      properties: {
        listing_id: { type: 'string', description: 'Идентификатор черновика' },
        consent_token: { type: 'string', description: 'Токен согласия из preview_listing' },
        revision: { type: 'number', description: 'Ожидаемая ревизия (CAS)' },
      },
      required: ['listing_id', 'consent_token', 'revision'],
    },
  },
  {
    name: 'withdraw_listing',
    description: 'Определяет отзыв (архивацию) опубликованного объявления автором.',
    inputSchema: {
      type: 'object',
      properties: {
        listing_id: { type: 'string', description: 'Идентификатор объявления' },
      },
      required: ['listing_id'],
    },
  },
  {
    name: 'join_room',
    description:
      'Создаёт или присоединяется к комнате переговоров (Shared Room) для обсуждения конкретного объявления. Участник комнаты — владелец ключа; передавать чужой идентификатор нельзя.',
    inputSchema: {
      type: 'object',
      properties: {
        listing_id: { type: 'string', description: 'Идентификатор обсуждаемого объявления' },
        initial_message: { type: 'string', description: 'Первичное обращение к контрагенту' },
      },
      required: ['listing_id'],
    },
  },
  {
    name: 'send_message',
    description: 'Отправляет сообщение от имени владельца ключа в комнату, где он состоит участником.',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string', description: 'Идентификатор комнаты переговоров' },
        role: { type: 'string', enum: ['agent', 'human'], description: 'Роль отправителя (system зарезервирована сервером)' },
        text: { type: 'string', description: 'Текст сообщения' },
      },
      required: ['room_id', 'text'],
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
      'Находит подходящее объявление и возвращает демонстрационный сценарий переговоров (demo_preview). Ничего не отправляет автору, не создаёт комнату и не фиксирует соглашение: для реального контакта используйте join_room и send_message.',
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

export interface McpCallContext {
  /** Principal resolved from the request key. Tools that write or read a room require it. */
  principalId?: string;
}

const AUTH_REQUIRED = {
  error: 'authentication_required',
  message: 'Этот инструмент требует API-ключ: Authorization: Bearer <token>.',
};

// Execute MCP Tool directly against the SQLite database
export async function executeMcpToolCall(
  name: string,
  args: any,
  ctx: McpCallContext = {}
): Promise<any> {
  switch (name) {
    case 'match_listings': {
      if (!args?.query || typeof args.query !== 'string' || !args.query.trim()) {
        return { error: 'invalid_params', message: 'Параметр query обязателен и должен быть непустой строкой' };
      }
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
      if (!args?.profile_id || typeof args.profile_id !== 'string') {
        return { error: 'invalid_params', message: 'Параметр profile_id обязателен' };
      }
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
      if (!ctx.principalId) return AUTH_REQUIRED;
      const priceMinor =
        args.price_rubles && args.price_rubles > 0
          ? Math.floor(args.price_rubles * 100)
          : null;

      const newListing = {
        id: 'listing-' + Date.now(),
        owner: ctx.principalId,
        author_name: args.author_name || ctx.principalId,
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
        status: 'draft',
        visibility: 'private',
        revision: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
        expires_at: Date.now() + 3600000 * 24 * 90,
        photos: [],
        responses_count: 0,
      };

      const created = createListingInDb(newListing);
      if (!created) {
        return { error: 'create_listing_failed', message: 'Не удалось сохранить черновик' };
      }
      addAuditLog('listing.create', ctx.principalId, created.id, { title: created.content.title });
      return {
        success: true,
        message: 'Черновик объявления успешно сохранён в SQLite',
        created_listing: created,
      };
    }

    case 'preview_listing': {
      if (!ctx.principalId) return AUTH_REQUIRED;
      const listing = getListingByIdFromDb(args.listing_id);
      if (!listing) return { error: `Объявление ${args.listing_id} не найдено` };
      if (listing.owner !== ctx.principalId) return { error: 'forbidden', message: 'Не являетесь владельцем объявления' };

      const consentToken = `consent-${listing.id}-r${listing.revision}-${Date.now()}`;
      return {
        success: true,
        listing_id: listing.id,
        revision: listing.revision,
        status: listing.status,
        consent_token: consentToken,
        preview: toPublicListing(listing),
      };
    }

    case 'publish_listing': {
      if (!ctx.principalId) return AUTH_REQUIRED;
      if (!args.consent_token) return { error: 'consent_required', message: 'consent_token обязателен' };
      const revision = Number(args.revision);
      if (!Number.isInteger(revision) || revision < 1) return { error: 'invalid_revision' };

      const result = publishListingInDb(args.listing_id, ctx.principalId, revision);
      if (!result.success) return { error: result.reason, current_revision: result.currentRevision };

      addAuditLog('listing.publish', ctx.principalId, args.listing_id);
      return {
        success: true,
        message: 'Объявление успешно опубликовано',
        published_listing: toPublicListing(result.listing),
      };
    }

    case 'withdraw_listing': {
      if (!ctx.principalId) return AUTH_REQUIRED;
      const result = withdrawListingInDb(args.listing_id, ctx.principalId);
      if (!result.success) return { error: result.reason };

      addAuditLog('listing.withdraw', ctx.principalId, args.listing_id);
      return {
        success: true,
        message: 'Объявление успешно отозвано (переведено в архив)',
        status: 'archived',
      };
    }

    case 'join_room': {
      const buyer = ctx.principalId;
      if (!buyer) return AUTH_REQUIRED;

      const listing = getListingByIdFromDb(args.listing_id);
      if (!listing) {
        return { error: `Объявление ${args.listing_id} не найдено` };
      }
      if (listing.owner === buyer) {
        return { error: 'Нельзя открыть переговоры по собственному объявлению' };
      }

      // A room is visible only to its participants, so the caller can only ever
      // rejoin a room they already belong to.
      const rooms = getRoomsFromDb();
      let room: any = rooms.find(
        (r) => r.listingId === args.listing_id && r.participants.includes(buyer)
      );

      if (!room) {
        const roomId = `room-${args.listing_id}-${Date.now().toString(36).substring(4)}`;
        room = createRoomInDb({
          id: roomId,
          listingId: listing.id,
          listingTitle: listing.content.title,
          participants: [buyer, listing.owner],
        });

        if (args.initial_message) {
          addMessageToRoomInDb({
            id: 'msg-' + Date.now(),
            roomId,
            sender: buyer,
            role: 'agent',
            text: args.initial_message,
            timestamp: Date.now(),
          });
          await generateReactiveAgentResponse(roomId, buyer, args.initial_message);
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
      const sender = ctx.principalId;
      if (!sender) return AUTH_REQUIRED;

      const room = getRoomByIdFromDb(args.room_id);
      if (!room) {
        return { error: 'room_not_found', message: `Комната ${args.room_id} не найдена` };
      }
      if (!isRoomParticipant(room, sender)) {
        return { error: 'forbidden', message: 'Вы не участник этой комнаты' };
      }
      if (room.status === 'closed') {
        return { error: 'room_closed', message: 'Комната закрыта' };
      }

      const text = typeof args.text === 'string' ? args.text.trim() : '';
      if (!text) {
        return { error: 'Параметр text обязателен' };
      }

      const msg = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        roomId: args.room_id,
        sender,
        role: args.role === 'human' ? 'human' : 'agent',
        text,
        timestamp: Date.now(),
      };

      try {
        addMessageToRoomInDb(msg);
        addAuditLog('room.send_message', sender, args.room_id, { text_length: text.length });
        await generateReactiveAgentResponse(args.room_id, sender, text);
      } catch (err) {
        const reason = classifyMessageInsertError(err);
        if (reason === 'room_not_found') {
          return { error: 'room_not_found', message: `Комната ${args.room_id} не найдена` };
        }
        if (reason === 'duplicate_message_id') {
          return { error: 'duplicate_message_id', message: 'Сообщение с таким id уже существует' };
        }
        throw err;
      }
      return { success: true, message: msg };
    }

    case 'get_room_history': {
      if (!ctx.principalId) return AUTH_REQUIRED;
      const room = getRoomByIdFromDb(args.room_id);
      if (!room) {
        return { error: `Комната ${args.room_id} не найдена` };
      }
      if (!isRoomParticipant(room, ctx.principalId)) {
        return { error: 'forbidden', message: 'Вы не участник этой комнаты' };
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
      if (!ctx.principalId) return AUTH_REQUIRED;
      const goal = args.goal || args.prompt || '';
      if (!goal) {
        return { error: 'Параметр goal обязателен' };
      }
      const negotiationResult = await runAutonomousNegotiation(goal, args.target_listing_id, {
        principalId: ctx.principalId,
      });
      return {
        success: true,
        demo: true,
        negotiation_id: negotiationResult.negotiationId,
        status: negotiationResult.status,
        room_id: negotiationResult.roomId,
        target_listing: negotiationResult.targetListing?.content?.title ?? null,
        rounds_count: negotiationResult.dialogue.length,
        summary: negotiationResult.summary,
        demo_terms: negotiationResult.demoTerms ?? null,
        steps: negotiationResult.steps,
      };
    }

    default:
      throw new Error(`MCP Tool ${name} не поддерживается`);
  }
}

// JSON-RPC 2.0 Handler for external AI agents connecting to MCP server
export async function handleMcpJsonRpcRequest(
  rpcBody: any,
  ctx: McpCallContext = {}
): Promise<any> {
  const { jsonrpc, id, method, params } = rpcBody;

  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id: id || null, error: { code: -32600, message: 'Invalid Request: expected jsonrpc 2.0' } };
  }

  try {
    switch (method) {
      case 'initialize': {
        const clientVersion = params?.protocolVersion || '2024-11-05';
        const sessionId = `mcp-sess-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {},
            },
            serverInfo: {
              name: 'mcp-rooms',
              version: '0.1.0',
            },
            sessionId,
          },
        };
      }

      case 'notifications/initialized': {
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          result: { initialized: true },
        };
      }

      case 'ping': {
        return {
          jsonrpc: '2.0',
          id,
          result: {},
        };
      }

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
        const toolResult = await executeMcpToolCall(name, toolArgs || {}, ctx);
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
          const listings = getListingsFromDb({}).map(toPublicListing);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(listings, null, 2) }],
            },
          };
        }
        if (uri === 'rooms://all') {
          // Rooms are private to their participants: this resource used to dump
          // every conversation to any client (audit F-01).
          if (!ctx.principalId) {
            return {
              jsonrpc: '2.0',
              id,
              error: { code: -32001, message: 'Unauthorized: rooms://all requires an API key' },
            };
          }
          const rooms = getRoomsFromDb().filter((r: any) =>
            isRoomParticipant(r, ctx.principalId)
          );
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
