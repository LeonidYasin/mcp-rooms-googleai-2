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

function buildDemoScript(bestMatch: any, userGoal: string = ''): DemoScript {
  const category = bestMatch.content?.category || 'services';
  const title = bestMatch.content?.title || 'Услуга / предложение';
  const price = bestMatch.content?.price_minor
    ? `${bestMatch.content.price_minor / 100} ₽`
    : (bestMatch.content?.price ? String(bestMatch.content.price) : 'По договорённости');
  const goalClean = userGoal.trim() ? userGoal.trim() : `Согласование условий по «${title}»`;
  const locality = bestMatch.content?.location || bestMatch.locality || 'Удалённо / онлайн';

  if (category === 'business') {
    return {
      angelMessage1: `Здравствуйте! Мой доверитель заинтересован в партнёрстве по проекту «${title}». Цель: ${goalClean}. Можем ли мы уточнить условия сотрудничества и формат взаимодействия?`,
      counterpartResponse1: `Приветствую! Мы открыты к сотрудничеству по проекту «${title}». Предлагаем зафиксировать формат звонка для обсуждения деталей.`,
      angelMessage2: `Подтверждаем интерес. Предлагаем согласовать удобное время для онлайн-встречи.`,
      counterpartResponse2: `Договорились, предложение внесено в пример протокола.`,
      demoTerms: {
        topic: `Партнёрство / сотрудничество: ${title}`,
        price: price !== 'По договорённости' ? price : 'Обсуждается при согласовании условий',
        schedule: 'По согласованию сторон (онлайн)',
        locationProtocol: 'Онлайн',
      },
    };
  }

  if (category === 'jobs') {
    return {
      angelMessage1: `Добрый день! Мой пользователь откликается по объявлению «${title}». Цель: ${goalClean}. Уточните, актуальны ли условия (${price}) и возможность обсуждения?`,
      counterpartResponse1: `Здравствуйте! Вакансия «${title}» открыта, условия (${price}) обсуждаемы. Готовы провести первичное собеседование / скрининг.`,
      angelMessage2: `Условия подходят. Предлагаем зафиксировать предварительное время для скрининга.`,
      counterpartResponse2: `Слот зарезервирован в примере расписания.`,
      demoTerms: {
        topic: `Отклик на позицию: ${title}`,
        price: price !== 'По договорённости' ? `${price}` : 'По договорённости',
        schedule: 'По согласованию сторон (пример)',
        locationProtocol: locality.toLowerCase().includes('онлайн') || locality.toLowerCase().includes('удал') ? 'Удалённо' : locality,
      },
    };
  }

  if (category === 'services') {
    return {
      angelMessage1: `Приветствую! Пользователю необходима услуга «${title}». Цель: ${goalClean}. Возможна ли фиксация условий и стоимости на уровне ${price}?`,
      counterpartResponse1: `Добрый день! Услуга «${title}» актуальна, стоимость (${price}) подтверждаем. Готовы согласовать детали выполнения и сроки.`,
      angelMessage2: `Условия устраивают. Предлагаем зафиксировать договоренности и перейти к согласованию ТЗ.`,
      counterpartResponse2: `Условия внесены в пример графика и протокола.`,
      demoTerms: {
        topic: `Оказание услуги: ${title} (${goalClean})`,
        price: price !== 'По договорённости' ? `Ориентир ~${price}` : 'По договорённости',
        schedule: 'В ближайшие согласованные сроки (пример)',
        locationProtocol: locality.toLowerCase().includes('онлайн') || locality.toLowerCase().includes('удал') ? 'Удалённо / онлайн' : locality,
      },
    };
  }

  if (category === 'real_estate') {
    return {
      angelMessage1: `Здравствуйте! Мой доверитель заинтересован в объекте «${title}». Цель: ${goalClean}. Подтвердите, пожалуйста, актуальность условий (${price}) и удобное время для осмотра.`,
      counterpartResponse1: `Приветствую! Объект «${title}» доступен, условия (${price}) соответствуют карточке. Готовы организовать просмотр в ближайшее удобное время.`,
      angelMessage2: `Время подходит. Контакты и точные координаты согласуем после подтверждения.`,
      counterpartResponse2: `Слот просмотра внесён в пример расписания.`,
      demoTerms: {
        topic: `Осмотр и согласование: ${title}`,
        price: price !== 'По договорённости' ? `${price}` : 'По договорённости',
        schedule: 'В согласованное сторонами время (пример)',
        locationProtocol: locality || 'Личный осмотр объекта; точный адрес не публикуется',
      },
    };
  }

  if (category === 'communities') {
    return {
      angelMessage1: `Приветствую! Мой пользователь хочет присоединиться к инициативе «${title}». Цель: ${goalClean}. Каковы регламент и ближайшая координационная сессия?`,
      counterpartResponse1: `Здравствуйте! Будем рады видеть в инициативе «${title}». Ближайшая онлайн-сессия планируется в ближайшие дни, повестка формируется совместно.`,
      angelMessage2: `Подтверждаем участие в онлайн-сессии.`,
      counterpartResponse2: `Участие внесено в пример повестки.`,
      demoTerms: {
        topic: `Участие в сообществе: ${title}`,
        price: price !== 'По договорённости' ? price : 'Открытое участие',
        schedule: 'Ближайшая онлайн-сессия (пример)',
        locationProtocol: 'Онлайн',
      },
    };
  }

  if (category === 'dating') {
    return {
      angelMessage1: `Здравствуйте! Мой доверитель заинтересован во встрече по предложению «${title}». Цель: ${goalClean}. Предлагаем встретиться в публичном месте.`,
      counterpartResponse1: `Привет! Предложение «${title}» актуально. Встреча в публичном месте — отличная идея.`,
      angelMessage2: `Мой пользователь подтверждает участие. Первая встреча — в общественном месте.`,
      counterpartResponse2: `Отлично, встреча зафиксирована в примере расписания.`,
      demoTerms: {
        topic: `Встреча: ${title}`,
        price: 'Бесплатно / личные расходы',
        schedule: 'Ближайшие выходные (пример)',
        locationProtocol: 'Публичное место',
      },
    };
  }

  return {
    angelMessage1: `Здравствуйте! Нас заинтересовало объявление «${title}». Цель: ${goalClean}. Подтвердите, пожалуйста, актуальность цены (${price}) и возможность передачи.`,
    counterpartResponse1: `Здравствуйте! Товар «${title}» в наличии, цена ${price} актуальна, передача возможна.`,
    angelMessage2: `Условия принимаем. Предлагаем передачу в публичном месте с проверкой товара.`,
    counterpartResponse2: `Слот для встречи внесён в пример расписания.`,
    demoTerms: {
      topic: `Приобретение: ${title} (${goalClean})`,
      price,
      schedule: 'Ближайшие выходные по согласованию (пример)',
      locationProtocol: locality || 'Самовывоз в публичном месте города',
    },
  };
}

/**
 * Generates an automated AI Agent counter-response when a user or another agent sends
 * a message in a active shared room.
 */
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

  const script = buildDemoScript(bestMatch, userPrompt);
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
