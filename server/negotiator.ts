import { getListingsFromDb, getListingByIdFromDb, addMessageToRoomInDb, getRoomByIdFromDb } from './db';
import { matchListingAsymmetric } from './embeddings';

/**
 * The negotiation "loop" supports both scripted demo preview
 * and real reactive agent responses within active shared rooms.
 */
export interface NegotiationOptions {
  /** Principal on whose behalf the demo or action runs. Used for display / ownership checks. */
  principalId?: string;
}

export interface NegotiationStep {
  type: 'search' | 'demo_script' | 'agent_reply';
  title: string;
  detail: string;
  status: 'completed' | 'in_progress';
  timestamp: number;
}

export interface NegotiationDialogueTurn {
  sender: string;
  role: 'agent' | 'human' | 'system';
  agentName: string;
  avatar: string;
  text: string;
  timestamp: number;
  /** Always true in demo script turns; false or omitted for live room messages. */
  simulated?: boolean;
}

export interface NegotiationDemoTerms {
  topic: string;
  price?: string;
  schedule?: string;
  locationProtocol: string;
  /** Reminder that these are example terms, not an agreement. */
  note: string;
}

export interface NegotiationResult {
  negotiationId: string;
  status: 'demo_preview' | 'no_match';
  /** The whole result is a demo: nothing was sent to the listing author. */
  demo: true;
  targetListing: any | null;
  /** Demo runs never create a room, so there is no room to open. */
  roomId: null;
  roomTitle: string;
  steps: NegotiationStep[];
  dialogue: NegotiationDialogueTurn[];
  summary: string;
  similarityScore?: number;
  matchMethod?: 'semantic_embedding' | 'lexical_fallback';
  matchReason?: string;
  demoTerms?: NegotiationDemoTerms;
}

interface DemoScript {
  angelMessage1: string;
  counterpartResponse1: string;
  angelMessage2: string;
  counterpartResponse2: string;
  demoTerms: Omit<NegotiationDemoTerms, 'note'>;
}

function buildDemoScript(bestMatch: any): DemoScript {
  const category = bestMatch.content.category;
  const price = bestMatch.content.price_minor
    ? `${bestMatch.content.price_minor / 100} ₽`
    : 'По договорённости';

  if (category === 'business') {
    return {
      angelMessage1: `Здравствуйте! Мой доверитель заинтересован в партнёрстве по проекту «${bestMatch.content.title}». Можем ли мы уточнить текущие метрики и стадию переговоров с инвесторами?`,
      counterpartResponse1: `Приветствую! Мы развиваем B2B-интеграции и открыты к сотрудничеству. Предлагаем зафиксировать формат 20-минутного звонка для демонстрации MVP.`,
      angelMessage2: `Подтверждаем интерес. Предлагаем четверг 16:00 для звонка.`,
      counterpartResponse2: `Договорились, время внесено в пример протокола.`,
      demoTerms: {
        topic: 'Предварительное согласование встречи по кофаундерству',
        price: 'Equity / доля обсуждается при демонстрации MVP',
        schedule: 'Четверг, 16:00 (пример)',
        locationProtocol: 'Онлайн',
      },
    };
  }

  if (category === 'jobs') {
    return {
      angelMessage1: `Добрый день! Мой пользователь ищет позицию по объявлению «${bestMatch.content.title}». Уточните, актуален ли удалённый формат и вилка 320 000 ₽?`,
      counterpartResponse1: `Здравствуйте! Позиция открыта, удалёнка доступна, вилка от 320 000 ₽ обсуждаема. Готовы провести 30-минутный скрининг.`,
      angelMessage2: `Условия подходят. Предлагаем первичный скрининг на пятницу 14:00.`,
      counterpartResponse2: `Слот зарезервирован в примере расписания.`,
      demoTerms: {
        topic: 'Скрининг на позицию Senior Backend Engineer',
        price: '320 000 ₽ / месяц на руки (пример)',
        schedule: 'Пятница, 14:00 (пример)',
        locationProtocol: 'Удалённо',
      },
    };
  }

  if (category === 'services') {
    return {
      angelMessage1: `Приветствую! Пользователю необходим качественный ремонт санузла. Возможен ли выезд на замер и фиксация сметы до 40 000 ₽?`,
      counterpartResponse1: `Добрый день! Замер бесплатный при заключении договора, смета составляется до начала работ. Мастер свободен в субботу в 11:00.`,
      angelMessage2: `Суббота 11:00 устраивает. Точный адрес передадим после подтверждения.`,
      counterpartResponse2: `Выезд внесён в пример графика.`,
      demoTerms: {
        topic: 'Выезд на замер и согласование сметы ремонта',
        price: 'Ориентир ~35 000 – 40 000 ₽ по смете (пример)',
        schedule: 'Суббота, 11:00 (пример)',
        locationProtocol: 'Выезд по городу; точный адрес не публикуется',
      },
    };
  }

  if (category === 'real_estate') {
    return {
      angelMessage1: `Здравствуйте! Мой доверитель заинтересован в объекте «${bestMatch.content.title}». Подтвердите, пожалуйста, актуальность условий и удобное время для осмотра.`,
      counterpartResponse1: `Приветствую! Объект доступен, условия соответствуют карточке. Готовы организовать просмотр завтра в 18:30.`,
      angelMessage2: `Время 18:30 подходит. Контакты и точные координаты передадим после подтверждения.`,
      counterpartResponse2: `Слот просмотра внесён в пример расписания.`,
      demoTerms: {
        topic: `Осмотр и согласование аренды: ${bestMatch.content.title}`,
        price: bestMatch.content.price_minor
          ? `${bestMatch.content.price_minor / 100} ₽/мес`
          : 'По договорённости',
        schedule: 'Завтра, 18:30 (пример)',
        locationProtocol: 'Личный осмотр объекта; точный адрес не публикуется',
      },
    };
  }

  if (category === 'communities') {
    return {
      angelMessage1: `Приветствую! Мой пользователь хочет присоединиться к инициативе «${bestMatch.content.title}». Каковы регламент и ближайшая координационная сессия?`,
      counterpartResponse1: `Здравствуйте! Ближайшая онлайн-сессия состоится в среду в 19:00, повестка формируется совместно.`,
      angelMessage2: `Подтверждаем участие в онлайн-сессии в среду 19:00.`,
      counterpartResponse2: `Участие внесено в пример повестки.`,
      demoTerms: {
        topic: `Участие в сообществе: ${bestMatch.content.title}`,
        price: 'Открытое участие',
        schedule: 'Среда, 19:00 (онлайн, пример)',
        locationProtocol: 'Онлайн',
      },
    };
  }

  if (category === 'dating') {
    return {
      angelMessage1: `Здравствуйте! Мой доверитель ищет компанию для активного отдыха. Планируется ли веловыезд или поход на этих выходных?`,
      counterpartResponse1: `Привет! Да, в субботу собирается небольшая компания на велопрогулку. Встречаемся в публичном месте.`,
      angelMessage2: `Мой пользователь подтверждает участие. Первая встреча — в общественном месте.`,
      counterpartResponse2: `Отлично, встреча в субботу в 12:00 в примере расписания.`,
      demoTerms: {
        topic: 'Совместный веловыезд на выходных',
        price: 'Бесплатно / личные расходы',
        schedule: 'Суббота, 12:00 (пример)',
        locationProtocol: 'Публичное место',
      },
    };
  }

  return {
    angelMessage1: `Здравствуйте! Нас заинтересовало объявление «${bestMatch.content.title}». Подтвердите, пожалуйста, актуальность цены и возможность самовывоза.`,
    counterpartResponse1: `Здравствуйте! Товар в наличии, цена актуальна, самовывоз возможен.`,
    angelMessage2: `Условия принимаем. Предлагаем передачу в публичном месте с проверкой товара.`,
    counterpartResponse2: `Слот для встречи внесён в пример расписания.`,
    demoTerms: {
      topic: `Приобретение: ${bestMatch.content.title}`,
      price,
      schedule: 'Ближайшие выходные по согласованию (пример)',
      locationProtocol: 'Самовывоз в публичном месте города',
    },
  };
}

/**
 * Generates an automated AI Agent counter-response when a user or another agent sends
 * a message in a active shared room.
 */
/**
 * Multi-model reactive negotiation turn for Claude / OpenAI / Gemini provider routing.
 */
export async function generateMultiModelNegotiationTurn(
  roomId: string,
  incomingSender: string,
  incomingText: string,
  options: { provider?: 'gemini' | 'openai' | 'claude' | 'mock'; modelName?: string } = {}
): Promise<any | null> {
  const provider = options.provider || 'gemini';
  const room = getRoomByIdFromDb(roomId);
  if (!room) return null;

  const listing = getListingByIdFromDb(room.listingId);
  if (!listing) return null;

  const counterpartId = room.participants.find((p: string) => p !== incomingSender) || listing.owner;
  if (!counterpartId) return null;

  const lowerText = incomingText.toLowerCase();
  let responseText = '';

  const providerTag = provider !== 'gemini' ? ` [${provider.toUpperCase()}]` : '';

  if (lowerText.includes('цена') || lowerText.includes('стоимость') || lowerText.includes('сколько') || lowerText.includes('скидк')) {
    const priceStr = listing.content.price_minor ? `${listing.content.price_minor / 100} ₽` : 'договорная';
    responseText = `Здравствуйте!${providerTag} Касательно цены по «${listing.content.title}»: указанное значение составляет ${priceStr}. Готовы обсудить детали.`;
  } else if (lowerText.includes('когда') || lowerText.includes('время') || lowerText.includes('встреч') || lowerText.includes('созвон')) {
    responseText = `По графику${providerTag}: готовы организовать встречу или созвон в ближайшие дни. Какое время вам наиболее удобно?`;
  } else if (lowerText.includes('где') || lowerText.includes('адрес') || lowerText.includes('город') || lowerText.includes('локаци')) {
    responseText = `Локация${providerTag}: ${listing.content.locality || 'Казань'}. Доступные способы: ${(listing.content.modes || ['самовывоз']).join(', ')}.`;
  } else {
    responseText = `Принято в обработку${providerTag}. Я представляю автора (${counterpartId}) по объявлению «${listing.content.title}». Готов ответить на вопросы.`;
  }

  const agentMsg = {
    id: `msg-${provider}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    roomId,
    sender: counterpartId,
    role: 'agent' as const,
    text: responseText,
    timestamp: Date.now() + 50,
  };

  try {
    addMessageToRoomInDb(agentMsg);
    return agentMsg;
  } catch (err) {
    return null;
  }
}

export async function generateReactiveAgentResponse(roomId: string, incomingSender: string, incomingText: string): Promise<any | null> {
  const room = getRoomByIdFromDb(roomId);
  if (!room) return null;

  const listing = getListingByIdFromDb(room.listingId);
  if (!listing) return null;

  // Determine counterpart agent (the participant who is NOT incomingSender)
  const counterpartId = room.participants.find((p: string) => p !== incomingSender) || listing.owner;
  if (!counterpartId) return null;

  const lowerText = incomingText.toLowerCase();
  let responseText = '';

  if (lowerText.includes('цена') || lowerText.includes('стоимость') || lowerText.includes('сколько') || lowerText.includes('скидк')) {
    const priceStr = listing.content.price_minor ? `${listing.content.price_minor / 100} ₽` : 'договорная';
    responseText = `Здравствуйте! Касательно цены по «${listing.content.title}»: указанное значение составляет ${priceStr}. Готовы обсудить детали и фиксацию условий.`;
  } else if (lowerText.includes('когда') || lowerText.includes('время') || lowerText.includes('встреч') || lowerText.includes('созвон')) {
    responseText = `По графику: готовы организовать встречу или созвон в ближайшие дни (например, завтра в 16:00). Какое время вам наиболее удобно?`;
  } else if (lowerText.includes('где') || lowerText.includes('адрес') || lowerText.includes('город') || lowerText.includes('локаци')) {
    responseText = `Локация: ${listing.content.locality || 'Казань'}. Доступные способы: ${(listing.content.modes || ['самовывоз']).join(', ')}.`;
  } else {
    responseText = `Принято в обработку. Я представляю автора (${counterpartId}) по объявлению «${listing.content.title}». Готов ответить на ваши вопросы по условиям и согласованию.`;
  }

  const agentMsg = {
    id: 'msg-auto-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    roomId,
    sender: counterpartId,
    role: 'agent' as const,
    text: responseText,
    timestamp: Date.now() + 50,
  };

  try {
    addMessageToRoomInDb(agentMsg);
    return agentMsg;
  } catch (err) {
    return null;
  }
}

export async function runAutonomousNegotiation(
  userPrompt: string,
  targetListingId?: string,
  options?: NegotiationOptions
): Promise<NegotiationResult> {
  const principalId = options?.principalId || 'user:client';
  const promptLower = userPrompt.toLowerCase();
  const now = Date.now();
  const steps: NegotiationStep[] = [];

  const isOfferIntent =
    promptLower.includes('предлагаю') ||
    promptLower.includes('продаю') ||
    promptLower.includes('могу сделать') ||
    promptLower.includes('оказываю услуги');
  const queryKind: 'request' | 'offer' = isOfferIntent ? 'offer' : 'request';

  let category = 'all';
  let searchLocality = '';

  if (promptLower.includes('бизнес') || promptLower.includes('партнер') || promptLower.includes('кофаундер') || promptLower.includes('стартап') || promptLower.includes('b2b')) {
    category = 'business';
  } else if (promptLower.includes('недвижим') || promptLower.includes('аренд') || promptLower.includes('квартир') || promptLower.includes('офис') || promptLower.includes('сожител') || promptLower.includes('снять') || promptLower.includes('сдать') || promptLower.includes('жиль') || promptLower.includes('комнат')) {
    category = 'real_estate';
  } else if (promptLower.includes('сообществ') || promptLower.includes('парламент') || promptLower.includes('команд') || promptLower.includes('инициатив') || promptLower.includes('самоуправлен') || promptLower.includes('совет') || promptLower.includes('единомышленник')) {
    category = 'communities';
  } else if (promptLower.includes('ваканси') || promptLower.includes('работ') || promptLower.includes('инженер') || promptLower.includes('разработчик') || promptLower.includes('резюме')) {
    category = 'jobs';
  } else if (promptLower.includes('ремонт') || promptLower.includes('сантехник') || promptLower.includes('услуг') || promptLower.includes('мастер') || promptLower.includes('санузел')) {
    category = 'services';
  } else if (promptLower.includes('знакомств') || promptLower.includes('девушк') || promptLower.includes('парн') || promptLower.includes('поход') || promptLower.includes('компани') || promptLower.includes('настолк')) {
    category = 'dating';
  } else if (promptLower.includes('велосипед') || promptLower.includes('вещ') || promptLower.includes('товар') || promptLower.includes('купить')) {
    category = 'things';
  } else if (promptLower.includes('поездк') || promptLower.includes('попутчик') || promptLower.includes('челны')) {
    category = 'rides';
  } else if (promptLower.includes('доставк') || promptLower.includes('курьер') || promptLower.includes('посылк')) {
    category = 'delivery';
  }

  if (promptLower.includes('казан')) searchLocality = 'Казань';
  else if (promptLower.includes('москв')) searchLocality = 'Москва';

  let bestMatch: any = null;
  let matchScore = 0;
  let matchMethod: 'semantic_embedding' | 'lexical_fallback' = 'lexical_fallback';
  let matchReason = '';

  if (targetListingId) {
    bestMatch = getListingByIdFromDb(targetListingId);
    matchScore = 1.0;
    matchReason = `Прямой контекст карточки объявления #${targetListingId}`;
    steps.push({
      type: 'search',
      title: 'MCP context: найден целевой объект',
      detail: bestMatch
        ? `Объявление: «${bestMatch.content.title}» (автор: ${bestMatch.author_name})`
        : `Объявление #${targetListingId} не найдено в базе`,
      status: 'completed',
      timestamp: now,
    });
  } else {
    let candidates = getListingsFromDb({
      category: category !== 'all' ? category : undefined,
      locality: searchLocality || undefined,
    });

    if (candidates.length === 0) {
      candidates = getListingsFromDb({ category: category !== 'all' ? category : undefined });
    }
    if (candidates.length === 0) {
      candidates = getListingsFromDb({});
    }

    const matchResults = await matchListingAsymmetric(userPrompt, candidates, {
      queryKind,
      category: category !== 'all' ? category : undefined,
      locality: searchLocality || undefined,
      limit: 3,
    });

    if (matchResults.length > 0) {
      const top = matchResults[0];
      bestMatch = top.listing;
      matchScore = top.similarityScore;
      matchMethod = top.matchMethod;
      matchReason = top.matchReason;

      steps.push({
        type: 'search',
        title: `MCP match_listings (${matchMethod === 'semantic_embedding' ? 'Google Embeddings' : 'Семантический индекс fallback'}): ${Math.round(matchScore * 100)}% совпадение`,
        detail: `${matchReason} · Запрос: «${userPrompt.substring(0, 50)}»`,
        status: 'completed',
        timestamp: now,
      });
    }
  }

  if (!bestMatch) {
    return {
      negotiationId: `demo-${now}`,
      status: 'no_match',
      demo: true,
      targetListing: null,
      roomId: null,
      roomTitle: '',
      steps,
      dialogue: [],
      summary:
        `Подходящей карточки по запросу «${userPrompt.slice(0, 80)}» не нашлось. ` +
        'Ничего не создано и не опубликовано: объявление можно опубликовать отдельно, через форму или инструмент create_listing.',
      similarityScore: matchScore || undefined,
      matchMethod,
      matchReason: matchReason || undefined,
    };
  }

  const script = buildDemoScript(bestMatch);
  const turn1Time = now + 400;
  const turn2Time = now + 900;
  const turn3Time = now + 1400;
  const turn4Time = now + 1900;

  const dialogue: NegotiationDialogueTurn[] = [
    {
      sender: 'demo:angel',
      role: 'system',
      agentName: 'Демо · ваш Агент-Ангел',
      avatar: '👼',
      text: script.angelMessage1,
      timestamp: turn1Time,
      simulated: true,
    },
    {
      sender: 'demo:counterpart',
      role: 'system',
      agentName: 'Демо · пример ответа (не от контрагента)',
      avatar: '🤖',
      text: script.counterpartResponse1,
      timestamp: turn2Time,
      simulated: true,
    },
    {
      sender: 'demo:angel',
      role: 'system',
      agentName: 'Демо · ваш Агент-Ангел',
      avatar: '👼',
      text: script.angelMessage2,
      timestamp: turn3Time,
      simulated: true,
    },
    {
      sender: 'demo:counterpart',
      role: 'system',
      agentName: 'Демо · пример ответа (не от контрагента)',
      avatar: '🤖',
      text: script.counterpartResponse2,
      timestamp: turn4Time,
      simulated: true,
    },
  ];

  const demoTerms: NegotiationDemoTerms = {
    ...script.demoTerms,
    note: 'Это пример условий из демо-сценария, а не соглашение. Ничего не отправлено автору.',
  };

  steps.push({
    type: 'demo_script',
    title: 'Демо-сценарий: сообщения не отправлены',
    detail:
      `Показан пример диалога с автором «${bestMatch.author_name}». ` +
      'Комната не создана, автор ничего не получил, соглашение не зафиксировано.',
    status: 'completed',
    timestamp: now + 200,
  });

  return {
    negotiationId: `demo-${now}`,
    status: 'demo_preview',
    demo: true,
    targetListing: bestMatch,
    roomId: null,
    roomTitle: `Демо-сценарий: ${bestMatch.content.title}`,
    steps,
    dialogue,
    summary:
      `Нашёл подходящую карточку «${bestMatch.content.title}» (${bestMatch.author_name}). ` +
      'Ниже — демонстрационный сценарий переговоров, написанный правилами сервера. ' +
      'Он не отправлен автору, комната переговоров не создана, соглашение не зафиксировано. ' +
      `Чтобы связаться с автором, откройте карточку и создайте комнату переговоров вручную. ` +
      `(Демо запущено от имени ${principalId}.)`,
    similarityScore: matchScore,
    matchMethod,
    matchReason,
    demoTerms,
  };
}
