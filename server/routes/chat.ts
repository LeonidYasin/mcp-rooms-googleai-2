import { Router } from 'express';
import { Type, FunctionDeclaration } from '@google/genai';
import { requireAuth } from '../auth';
import { rateLimit } from '../http-guard';
import { getListingByIdFromDb, getListingsFromDb } from '../db';
import { executeMcpToolCall } from '../mcp';
import { runAutonomousNegotiation } from '../negotiator';
import { configuredModel, resolveLlmClient, recordLlmFailure, callGeminiWithOAuth } from '../llm';
import { executeOpenAiChatWithMcp } from '../llm-openai';
import { logger } from '../logger';

export const chatRouter = Router();

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
  {
    name: 'send_support_message',
    description: 'Отправляет разработчикам и в саппорт платформы сообщение с обратной связью, баг-репортом или идеей улучшения.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        message: { type: Type.STRING, description: 'Текст обращения, пожелание или описание проблемы' },
        category: { type: Type.STRING, description: 'Категория: feedback, feature_request, bug_report, support, other' },
        contact: { type: Type.STRING, description: 'Контактные данные для связи (Telegram, email)' },
      },
      required: ['message'],
    },
  },
];

chatRouter.post('/api/chat', requireAuth, rateLimit('chat', 'RATE_LIMIT_CHAT_PER_MINUTE', 30), async (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const { messages, targetListingId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Параметр messages обязателен и должен быть массивом' });
      return;
    }

    const userPrompt = messages[messages.length - 1]?.content || '';
    const promptLower = userPrompt.toLowerCase();

    // Multi-provider inputs from headers or body
    const customProvider = ((req.headers['x-llm-provider'] as string) || req.body?.llmProvider || '').toLowerCase();
    const customApiKey = (req.headers['x-llm-api-key'] as string) || req.body?.llmApiKey;
    const customModel = (req.headers['x-llm-model'] as string) || req.body?.llmModel;
    const customBaseUrl = (req.headers['x-llm-base-url'] as string) || req.body?.llmBaseUrl;

    const userGeminiApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.geminiApiKey || (customProvider === 'gemini' ? customApiKey : undefined);
    const googleAccessToken = (req.headers['x-google-access-token'] as string) || req.body?.googleAccessToken;
    let llmDegradedReason: string | null = null;

    const systemInstruction = `Ты — персональный ИИ-ассистент («Агент-Ангел») площадки объявлений, идей и совместных проектов «Хочу · Предлагаю» (MCP Rooms).
Ты общаешься тепло, дружелюбно, с заботой, непринуждённо и на живом русском языке.
Ты готов свободно поддержать беседу на абсолютно любые темы — обсудить идеи, проектные планы, технологии или просто приятно пообщаться.

Когда собеседник ищет возможности, людей, специалистов, жильё или товары:
- Используй инструменты search_listings или match_listings, чтобы найти актуальные совпадения в базе данных SQLite.
- Если просит договориться или подготовить условия сделки — вызови negotiate_agreement (демонстрационный сценарий переговоров).
- Если хочет опубликовать объявление или предложить услугу — вызови create_listing.
- Если у пользователя есть пожелание разработчикам, идея фичи или баг-репорт — вызови send_support_message.

Отвечай естественно, легко, с открытостью к диалогу и искренним желанием помочь.`;

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

    // 1. Priority: Multi-Provider LLM (OpenRouter, DeepSeek, OpenAI, Groq, custom)
    const serverOpenRouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
    const serverOpenRouterModel = (process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat:free').trim();

    const isGeminiExplicit = customProvider === 'gemini' || Boolean(userGeminiApiKey);
    const openAiApiKey = !isGeminiExplicit
      ? (customApiKey || (!configuredModel() && !process.env.GEMINI_API_KEY ? serverOpenRouterKey : '')).trim()
      : '';

    if (openAiApiKey) {
      const effectiveProvider = customProvider || (openAiApiKey.startsWith('sk-or-') ? 'openrouter' : openAiApiKey.includes('deepseek') ? 'deepseek' : 'openrouter');
      const effectiveModel = customModel || (effectiveProvider === 'openrouter' ? serverOpenRouterModel : 'gpt-4o-mini');

      try {
        const openAiChatResult = await executeOpenAiChatWithMcp({
          apiKey: openAiApiKey,
          baseUrl: customBaseUrl,
          model: effectiveModel,
          messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
          systemInstruction,
          providerName: effectiveProvider,
          principalId,
          executeTool: executeMcpToolCall,
        });

        res.json({
          text: openAiChatResult.text || 'Действие успешно выполнено через протокол MCP.',
          model: openAiChatResult.model,
          degraded: false,
          authType: effectiveProvider,
          executedTools: openAiChatResult.executedTools,
          negotiation: openAiChatResult.negotiationResult,
          createdListing: openAiChatResult.createdListingResult,
        });
        return;
      } catch (openAiErr: any) {
        logger.warn('OpenAI-compatible LLM call failed, falling back to Gemini/rules', {
          error: openAiErr.message,
          status: openAiErr.status,
        });
        llmDegradedReason = openAiErr.status === 401 ? 'invalid_api_key' : 'model_error';
      }
    }

    // 2. Google Gemini: user-provided Gemini API key or server-configured Gemini
    const effectiveModel = configuredModel() || (userGeminiApiKey ? 'gemini-1.5-flash' : '');
    const llm = resolveLlmClient(userGeminiApiKey);

    const aiClient = llm.client;
    if (aiClient) {
      try {
        const response = await aiClient.models.generateContent({
          model: effectiveModel,
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
            model: effectiveModel,
            contents: followUpContents,
            config: {
              systemInstruction,
              temperature: 0.7,
            },
          });

          res.json({
            text: followUpResponse.text || 'Действие успешно выполнено через протокол MCP.',
            model: effectiveModel,
            degraded: false,
            authType: userGeminiApiKey ? 'user_gemini_key' : 'server_llm',
            executedTools: executedToolsLog,
            negotiation: negotiationResult,
            createdListing: createdListingResult,
          });
          return;
        }

        if (response.text) {
          res.json({
            text: response.text,
            model: effectiveModel,
            degraded: false,
            authType: userGeminiApiKey ? 'user_gemini_key' : 'server_llm',
            executedTools: [],
          });
          return;
        }
      } catch (geminiError: any) {
        llmDegradedReason = recordLlmFailure(geminiError);
      }
    } else {
      llmDegradedReason = llm.reason;
    }

    // 2. If no direct API key but Google OAuth token is present, attempt callGeminiWithOAuth
    if (googleAccessToken && !userGeminiApiKey) {
      try {
        const oauthResp = await callGeminiWithOAuth({
          accessToken: googleAccessToken,
          contents,
          systemInstruction,
          tools: [{ functionDeclarations: mcpGeminiTools }],
        });

        if (oauthResp.functionCalls && oauthResp.functionCalls.length > 0) {
          const executedToolsLog: any[] = [];
          let negotiationResult: any = null;
          let createdListingResult: any = null;
          const functionResponseParts: any[] = [];

          for (const call of oauthResp.functionCalls) {
            if (!call.name) continue;
            try {
              const result = await executeMcpToolCall(call.name, call.args || {}, { principalId });
              executedToolsLog.push({ name: call.name, args: call.args, result });

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

          const followUpContents = [
            ...contents,
            oauthResp.candidateContent || {
              role: 'model',
              parts: oauthResp.functionCalls.map((fc) => ({
                functionCall: { name: fc.name, args: fc.args },
              })),
            },
            {
              role: 'user',
              parts: functionResponseParts,
            },
          ];

          const followUpResponse = await callGeminiWithOAuth({
            accessToken: googleAccessToken,
            contents: followUpContents,
            systemInstruction,
          });

          res.json({
            text: followUpResponse.text || 'Действие успешно выполнено через протокол MCP.',
            model: configuredModel() || 'gemini-1.5-flash',
            degraded: false,
            authType: 'google_oauth',
            executedTools: executedToolsLog,
            negotiation: negotiationResult,
            createdListing: createdListingResult,
          });
          return;
        }

        if (oauthResp.text) {
          res.json({
            text: oauthResp.text,
            model: configuredModel() || 'gemini-1.5-flash',
            degraded: false,
            authType: 'google_oauth',
            executedTools: [],
          });
          return;
        }
      } catch (oauthErr: any) {
        logger.warn('Google OAuth Gemini call failed, falling back to server LLM/rules', {
          error: oauthErr.message,
          status: oauthErr.status,
        });
        llmDegradedReason = oauthErr.status === 401 ? 'google_token_expired' : 'model_error';
      }
    }

    if (!llmDegradedReason) {
      llmDegradedReason = 'model_error';
    }

    // -----------------------------------------------------------------
    // Intelligent Dynamic Fallback (when API key is absent or quota limited)
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
            '✨ Демонстрационный сценарий переговоров по вашему запросу (автору пока ничего не отправлено):\n\n' +
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

**Чего пока нет:** ролей и scope у ключей (любой действующий ключ может многое), общего лимита запросов между инстансами (счётчики живут в памяти процесса), аудит-лога чтения комнат. Для SSE-потока токен передаётся в query-параметре и может попасть в логи прокси. Публикация идёт сразу, без модерации.

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

    // 5. Friendly conversational guidance
    let greetingPrefix = 'Привет! Рад вас слышать 😊';
    if (promptLower.includes('как дела') || promptLower.includes('как жизнь') || promptLower.includes('как поживаешь')) {
      greetingPrefix = 'У меня всё отлично, спасибо за заботу! 🌟 Настроение прекрасное, готов общаться и помогать вам.';
    } else if (promptLower.includes('кто ты') || promptLower.includes('расскажи о себе') || promptLower.includes('что ты умеешь')) {
      greetingPrefix = 'Я Агент-Ангел — ваш дружелюбный персональный ИИ-ассистент на площадке «Хочу · Предлагаю» 👼';
    }

    res.json({
      text: `${greetingPrefix}

Сейчас я отвечаю в базовом режиме локального ассистента.

Чтобы мы могли свободно общаться на абсолютно любые темы (от философии и стартапов до программирования и жизни) с помощью современных нейросетей (**OpenRouter, DeepSeek, Gemini, OpenAI**), выберите ИИ в настройках (кнопка «✨ Выбрать ИИ» вверху чата).

А прямо сейчас я с радостью помогу вам найти нужные объявления, людей, жильё или услуги в каталоге — просто напишите, что вас интересует (например: *«Ищу коворкинг в Казани»*, *«Нужен мастер по ремонту»*, *«Ищу партнёра в стартап»*)!`,
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
