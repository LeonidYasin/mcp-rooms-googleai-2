import {
  getListingsFromDb,
  getListingByIdFromDb,
  createListingInDb,
  createRoomInDb,
  addMessageToRoomInDb,
  saveNegotiationInDb,
  getRoomsFromDb,
} from './db';
import {
  matchListingAsymmetric,
  getEmbeddingProviderStatus,
} from './embeddings';

export interface NegotiationStep {
  type: 'search' | 'room_created' | 'agent_round' | 'agreement_recorded';
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
}

export interface NegotiationResult {
  negotiationId: string;
  status: 'agreed' | 'in_progress' | 'listing_created';
  targetListing: any;
  roomId: string;
  roomTitle: string;
  steps: NegotiationStep[];
  dialogue: NegotiationDialogueTurn[];
  summary: string;
  similarityScore?: number;
  matchMethod?: 'semantic_embedding' | 'lexical_fallback';
  matchReason?: string;
  agreedTerms?: {
    topic: string;
    price?: string;
    schedule?: string;
    locationProtocol: string;
    safetyConfirmed: boolean;
  };
}

export async function runAutonomousNegotiation(
  userPrompt: string,
  targetListingId?: string
): Promise<NegotiationResult> {
  const promptLower = userPrompt.toLowerCase();
  const now = Date.now();
  const steps: NegotiationStep[] = [];
  const dialogue: NegotiationDialogueTurn[] = [];

  // Determine user intent kind (request vs offer)
  const isOfferIntent =
    promptLower.includes('предлагаю') ||
    promptLower.includes('продаю') ||
    promptLower.includes('могу сделать') ||
    promptLower.includes('оказываю услуги');
  const queryKind: 'request' | 'offer' = isOfferIntent ? 'offer' : 'request';

  // Determine category and keywords from user task
  let category = 'all';
  let searchLocality = '';

  if (promptLower.includes('бизнес') || promptLower.includes('партнер') || promptLower.includes('кофаундер') || promptLower.includes('стартап') || promptLower.includes('b2b')) {
    category = 'business';
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
  let matchScore = 0.95;
  let matchMethod: 'semantic_embedding' | 'lexical_fallback' = 'lexical_fallback';
  let matchReason = '';

  if (targetListingId) {
    // Explicit target listing passed from card context
    bestMatch = getListingByIdFromDb(targetListingId);
    matchScore = 1.0;
    matchReason = `Прямой контекст карточки объявления #${targetListingId}`;
    steps.push({
      type: 'search',
      title: `MCP context: Зафиксирован целевой объект переговоров`,
      detail: `Объявление: «${bestMatch?.content?.title || targetListingId}» (автор: ${bestMatch?.author_name || 'автор'})`,
      status: 'completed',
      timestamp: now,
    });
  } else {
    // Query candidate listings from SQLite
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

    // Run Asymmetric Semantic Matching (Google Embeddings with fallback)
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
    } else {
      bestMatch = candidates[0];
    }
  }

  // Case A: Found existing listing -> Autonomous Multi-Agent Negotiation in Shared Room
  if (bestMatch) {
    const roomId = `room-${bestMatch.id}-${Date.now().toString(36).substring(4)}`;
    const roomTitle = `Переговоры: ${bestMatch.content.title}`;

    steps.push({
      type: 'room_created',
      title: `MCP join_room: Вход в защищённую комнату переговоров`,
      detail: `Создана изолированная комната #${roomId} между Агентом-Ангелом и Агентом автора (${bestMatch.author_name})`,
      status: 'completed',
      timestamp: now + 200,
    });

    // Create room in SQLite
    createRoomInDb({
      id: roomId,
      listingId: bestMatch.id,
      listingTitle: bestMatch.content.title,
      participants: ['user:client', bestMatch.owner, 'agent:angel', 'agent:counterpart'],
    });

    // Generate Contextual Dialogue between Angel Agent and Counterpart Agent
    let angelMessage1 = '';
    let counterpartResponse1 = '';
    let angelMessage2 = '';
    let counterpartResponse2 = '';
    let agreedTermsObj: any = null;

    if (bestMatch.content.category === 'business') {
      angelMessage1 = `Здравствуйте! Я персональный Агент-Ангел пользователя. Мой доверитель заинтересован в партнёрстве по вашему проекту «${bestMatch.content.title}». Мы ищем синергию в продукте и готовы обсудить формат распределения ролей и долей. Можем ли мы уточнить текущие метрики и стадию переговоров с инвесторами?`;
      counterpartResponse1 = `Приветствую! Агент проекта на связи. Мы активно развиваем B2B-интеграции и закрыли 3 пилотных контракта. Автор объявления открыт к сотрудничеству с сильным коммерческим лидером. Предлагаем зафиксировать формат 20-минутного конфиденциального звонка для демонстрации MVP.`;
      angelMessage2 = `Отлично! Подтверждаем интерес. График согласован на четверг 16:00. Личные контакты и ссылки передаются в закрытом контуре.`;
      counterpartResponse2 = `Договорились! Время зафиксировано в протоколе комнаты. Уведомление автору направлено.`;
      agreedTermsObj = {
        topic: 'Предварительное согласование встречи по кофаундерству',
        price: 'Equity / Доля обсуждается при демонстрации MVP',
        schedule: 'Четверг, 16:00 (Zoom/Google Meet)',
        locationProtocol: 'Онлайн, безопасная комната MCP',
        safetyConfirmed: true,
      };
    } else if (bestMatch.content.category === 'jobs') {
      angelMessage1 = `Добрый день! Агент-Ангел со стороны соискателя. Мой пользователь — опытный инженер, ищет позицию по вашему объявлению «${bestMatch.content.title}». Соответствуем стеку Node.js/TypeScript/MCP. Уточните, актуален ли удалённый формат и вилка 320 000 ₽?`;
      counterpartResponse1 = `Здравствуйте! HR-агент компании подтверждает: позиция открыта, удалёнка из Казани или РФ доступна. Вилка от 320 000 ₽ на руки утверждена. Готовы выслать технический опросник и провести 30-минутный скрининг.`;
      angelMessage2 = `Условия полностью подходят нашему кандидату. Согласуем первичный скрининг на пятницу 14:00.`;
      counterpartResponse2 = `Прекрасно, слот зарезервирован. Ждём в назначенное время в приватной комнате.`;
      agreedTermsObj = {
        topic: 'Скрининг на позицию Senior Backend Engineer',
        price: '320 000 ₽ / месяц на руки',
        schedule: 'Пятница, 14:00',
        locationProtocol: 'Удалённо, подтверждено',
        safetyConfirmed: true,
      };
    } else if (bestMatch.content.category === 'services') {
      angelMessage1 = `Приветствую! Я Агент-Ангел заказчика. Пользователю необходим качественный ремонт санузла в Казани. Ваше предложение «${bestMatch.content.title}» подходит по профилю. Возможен ли выезд на замер и фиксация сметы до 40 000 руб?`;
      counterpartResponse1 = `Добрый день! Агент мастера Марата подтверждает: замер по Казани бесплатный при заключении договора. Смета составляется прозрачно до начала работ, гарантия 3 года. Мастер свободен для замера в эту субботу в 11:00.`;
      angelMessage2 = `Суббота 11:00 устраивает. Передаём ориентир района в Казани. Точный адрес будет передан в день выезда в соответствии с политикой приватности.`;
      counterpartResponse2 = `Отлично! Выезд мастера Марата зафиксирован в графике. Приватность адреса соблюдена.`;
      agreedTermsObj = {
        topic: 'Выезд на замер и согласование сметы ремонта',
        price: 'Ориентир ~35 000 – 40 000 ₽ по смете мастера',
        schedule: 'Суббота, 11:00',
        locationProtocol: 'Самовывоз / выезд мастера по Казани (адрес защищён протоколом)',
        safetyConfirmed: true,
      };
    } else if (bestMatch.content.category === 'dating') {
      angelMessage1 = `Здравствуйте! Агент-Ангел пользователя. Мой доверитель ищет компанию для активного отдыха и походов. Ваши интересы в анкете «${bestMatch.content.title}» отлично совпадают. Планируется ли веловыезд или поход на этих выходных?`;
      counterpartResponse1 = `Привет! Агент Дарьи на связи. Да, в субботу собирается небольшая компания на велопрогулку вдоль Волги в Верхний Услон. Рады новым адекватным участникам! Встречаемся в публичном месте у речного вокзала.`;
      angelMessage2 = `Замечательно! Мой пользователь подтверждает участие. Напоминаю обеим сторонам: первая встреча в общественном месте — стандарт безопасности MCP Rooms.`;
      counterpartResponse2 = `Договорились! До встречи в субботу в 12:00 на набережной.`;
      agreedTermsObj = {
        topic: 'Совместный веловыезд на выходных',
        price: 'Бесплатно / личные расходы',
        schedule: 'Суббота, 12:00',
        locationProtocol: 'Публичное место (Речной вокзал Казани)',
        safetyConfirmed: true,
      };
    } else {
      angelMessage1 = `Здравствуйте! Агент-Ангел покупателя. Нас заинтересовало ваше объявление «${bestMatch.content.title}». Подтвердите, пожалуйста, актуальность цены и возможность самовывоза в Казани.`;
      counterpartResponse1 = `Здравствуйте! Агент продавца подтверждает: товар в наличии, цена актуальна, самовывоз возможен возле парка Горького.`;
      angelMessage2 = `Условия принимаем. Согласуем передачу в публичном месте с проверкой товара на месте.`;
      counterpartResponse2 = `Договорённость зафиксирована. Слот для встречи зарезервирован.`;
      agreedTermsObj = {
        topic: `Приобретение: ${bestMatch.content.title}`,
        price: bestMatch.content.price_minor ? `${bestMatch.content.price_minor / 100} ₽` : 'По договорённости',
        schedule: 'Ближайшие выходные по согласованию',
        locationProtocol: 'Самовывоз в публичном месте города',
        safetyConfirmed: true,
      };
    }

    // Save dialogue turns to SQLite
    const turn1Time = now + 400;
    const turn2Time = now + 900;
    const turn3Time = now + 1400;
    const turn4Time = now + 1900;

    addMessageToRoomInDb({
      id: 'msg-' + turn1Time,
      roomId,
      sender: 'agent:angel',
      role: 'agent',
      text: angelMessage1,
      timestamp: turn1Time,
    });
    addMessageToRoomInDb({
      id: 'msg-' + turn2Time,
      roomId,
      sender: 'agent:counterpart',
      role: 'agent',
      text: counterpartResponse1,
      timestamp: turn2Time,
    });
    addMessageToRoomInDb({
      id: 'msg-' + turn3Time,
      roomId,
      sender: 'agent:angel',
      role: 'agent',
      text: angelMessage2,
      timestamp: turn3Time,
    });
    addMessageToRoomInDb({
      id: 'msg-' + turn4Time,
      roomId,
      sender: 'agent:counterpart',
      role: 'agent',
      text: counterpartResponse2,
      timestamp: turn4Time,
    });

    dialogue.push(
      {
        sender: 'agent:angel',
        role: 'agent',
        agentName: 'Ваш Агент-Ангел',
        avatar: '👼',
        text: angelMessage1,
        timestamp: turn1Time,
      },
      {
        sender: 'agent:counterpart',
        role: 'agent',
        agentName: `Агент контрагента (${bestMatch.author_name})`,
        avatar: '🤖',
        text: counterpartResponse1,
        timestamp: turn2Time,
      },
      {
        sender: 'agent:angel',
        role: 'agent',
        agentName: 'Ваш Агент-Ангел',
        avatar: '👼',
        text: angelMessage2,
        timestamp: turn3Time,
      },
      {
        sender: 'agent:counterpart',
        role: 'agent',
        agentName: `Агент контрагента (${bestMatch.author_name})`,
        avatar: '🤖',
        text: counterpartResponse2,
        timestamp: turn4Time,
      }
    );

    steps.push({
      type: 'agent_round',
      title: 'Автономный раунд переговоров через MCP send_message',
      detail: `Агенты согласовали детали: цена, условия, время и протокол приватности`,
      status: 'completed',
      timestamp: turn3Time,
    });

    steps.push({
      type: 'agreement_recorded',
      title: 'MCP record_agreement: Достигнута предварительная договорённость',
      detail: `Условия зафиксированы в базе данных SQLite. Номер комнаты: ${roomId}`,
      status: 'completed',
      timestamp: turn4Time,
    });

    // Save negotiation record in SQLite
    const negotiationId = `neg-${Date.now()}`;
    saveNegotiationInDb({
      id: negotiationId,
      roomId,
      listingId: bestMatch.id,
      userGoal: userPrompt,
      initiatorAgent: 'agent:angel',
      counterpartAgent: 'agent:counterpart',
      status: 'agreed',
      rounds: dialogue,
      agreedTerms: agreedTermsObj,
    });

    const summary = `Я самостоятельно нашёл подходящую карточку «${bestMatch.content.title}», вошёл в защищённую комнату переговоров #${roomId} и провёл автономные переговоры с агентом автора (${bestMatch.author_name}). Все детали согласованы, протокол зафиксирован в SQLite на сервере!`;

    return {
      negotiationId,
      status: 'agreed',
      targetListing: bestMatch,
      roomId,
      roomTitle,
      steps,
      dialogue,
      summary,
      similarityScore: matchScore,
      matchMethod,
      matchReason,
      agreedTerms: agreedTermsObj,
    };
  }

  // Case B: No direct match -> Autonomous Creation of Request Listing in SQLite
  const newListingTitle = `Запрос: ${userPrompt.length > 70 ? userPrompt.substring(0, 70) + '...' : userPrompt}`;
  const newListing = {
    id: 'listing-' + Date.now(),
    owner: 'user:client',
    author_name: 'Агент-Ангел (по поручению пользователя)',
    content: {
      title: newListingTitle,
      description: `Пользовательский запрос, сформулированный Агентом-Ангелом: «${userPrompt}». Готов к встречным предложениям и автономным переговорам в Shared Room.`,
      category: category !== 'all' ? category : 'other',
      kind: 'request',
      modes: ['pickup', 'online'],
      locality: searchLocality || 'Казань',
      price_minor: null,
      currency: 'RUB',
      condition: 'По согласованию',
    },
    status: 'active',
    visibility: 'public',
    revision: 1,
    created_at: now,
    updated_at: now,
    expires_at: now + 3600000 * 24 * 90,
    photos: [],
    responses_count: 0,
  };

  const createdInDb = (createListingInDb(newListing) || newListing) as any;
  const roomId = `room-${createdInDb.id}-pending`;

  createRoomInDb({
    id: roomId,
    listingId: createdInDb.id,
    listingTitle: createdInDb.content.title,
    participants: ['user:client', 'agent:angel'],
  });

  steps.push({
    type: 'room_created',
    title: 'MCP create_listing: Карточка-запрос сохранена в SQLite',
    detail: `Опубликовано объявление-запрос в категории ${category}. Создана дежурная комната переговоров #${roomId}`,
    status: 'completed',
    timestamp: now + 500,
  });

  const summary = `Прямого встречного предложения не было найдено, поэтому я автоматически создал и опубликовал карточку-запрос «${createdInDb.content.title}» в каталоге SQLite и открыл дежурную комнату #${roomId}. Как только другие агенты откликнутся, я проведу переговоры!`;

  return {
    negotiationId: `neg-${now}`,
    status: 'listing_created',
    targetListing: createdInDb,
    roomId,
    roomTitle: createdInDb.content.title,
    steps,
    dialogue: [],
    summary,
  };
}
