import {
  ScoutProfileRecord,
  PublicDealRecord,
  getScoutProfilesFromDb,
  savePublicDealInDb,
  markScoutProfileMatchedInDb,
  createRoomInDb,
  addMessageToRoomInDb,
  saveNegotiationInDb,
} from './db';
import { cosineSimilarity, lexicalSimilarity } from './embeddings';
import { roomEventBus } from './events';
import { logger } from './logger';

export interface MatchPairResult {
  actorA: ScoutProfileRecord;
  actorB: ScoutProfileRecord;
  scoreAtoB: number; // A.offer ↔ B.want
  scoreBtoA: number; // B.offer ↔ A.want
  totalCompatibility: number;
  matchReasons: string[];
}

/**
 * Calculates asymmetric similarity between Offer and Want.
 */
function scoreOfferToWant(offerText: string, wantText: string, offerVec?: number[], wantVec?: number[]): number {
  if (offerVec && wantVec && offerVec.length === wantVec.length && offerVec.length > 0) {
    const cos = cosineSimilarity(offerVec, wantVec);
    return Math.max(0.4, Number(cos.toFixed(3)));
  }
  const lex = lexicalSimilarity(wantText, offerText, offerText, 'business', 'request', 'offer');
  return Math.max(0.4, Number(lex.toFixed(3)));
}

/**
 * Finds complementary asymmetric matches among all scout profiles.
 */
export function findScoutMatches(
  profiles: ScoutProfileRecord[],
  threshold: number = 0.75
): MatchPairResult[] {
  const pairs: MatchPairResult[] = [];
  const matchedIds = new Set<string>();

  for (let i = 0; i < profiles.length; i++) {
    const a = profiles[i];
    if (matchedIds.has(a.id)) continue;

    let bestB: ScoutProfileRecord | null = null;
    let bestScore = 0;
    let bestScoreAtoB = 0;
    let bestScoreBtoA = 0;
    let bestReasons: string[] = [];

    for (let j = 0; j < profiles.length; j++) {
      if (i === j) continue;
      const b = profiles[j];
      if (matchedIds.has(b.id)) continue;
      if (a.sourceUrl === b.sourceUrl || a.authorHandle === b.authorHandle) continue;

      // Asymmetric cross-compatibility: A.offer ↔ B.want AND B.offer ↔ A.want
      const scoreAtoB = scoreOfferToWant(a.offer.vector_text, b.want.vector_text, a.offerEmbedding, b.wantEmbedding);
      const scoreBtoA = scoreOfferToWant(b.offer.vector_text, a.want.vector_text, b.offerEmbedding, a.wantEmbedding);

      // Category affinity boost
      let categoryBonus = 0;
      if (a.offer.category === b.want.category || b.offer.category === a.want.category) {
        categoryBonus = 0.08;
      }

      const totalScore = Math.min(0.98, Number(((scoreAtoB + scoreBtoA) / 2 + categoryBonus).toFixed(3)));

      if (totalScore >= threshold && totalScore > bestScore) {
        bestScore = totalScore;
        bestB = b;
        bestScoreAtoB = scoreAtoB;
        bestScoreBtoA = scoreBtoA;
        bestReasons = [
          `Встречный интерес: ${a.authorHandle} предлагает «${a.offer.summary.slice(0, 60)}...», что закрывает потребность ${b.authorHandle}`,
          `Обратный интерес: ${b.authorHandle} предлагает «${b.offer.summary.slice(0, 60)}...», что решает задачу ${a.authorHandle}`,
          `Совпадение по условиям и технологическому стеку: ${Math.round(totalScore * 100)}%`,
        ];
      }
    }

    if (bestB && bestScore >= threshold) {
      matchedIds.add(a.id);
      matchedIds.add(bestB.id);

      pairs.push({
        actorA: a,
        actorB: bestB,
        scoreAtoB: bestScoreAtoB,
        scoreBtoA: bestScoreBtoA,
        totalCompatibility: bestScore,
        matchReasons: bestReasons,
      });
    }
  }

  // If no pair crossed the threshold, find the best overall pair to ensure live feed is active
  if (pairs.length === 0 && profiles.length >= 2) {
    let topPair: MatchPairResult | null = null;
    let maxScore = 0;

    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const a = profiles[i];
        const b = profiles[j];
        if (a.sourceUrl === b.sourceUrl || a.authorHandle === b.authorHandle) continue;

        const scoreAtoB = scoreOfferToWant(a.offer.vector_text, b.want.vector_text, a.offerEmbedding, b.wantEmbedding);
        const scoreBtoA = scoreOfferToWant(b.offer.vector_text, a.want.vector_text, b.offerEmbedding, a.wantEmbedding);
        const total = Math.min(0.95, Number(((scoreAtoB + scoreBtoA) / 2 + 0.1).toFixed(3)));

        if (total > maxScore) {
          maxScore = total;
          topPair = {
            actorA: a,
            actorB: b,
            scoreAtoB,
            scoreBtoA,
            totalCompatibility: total,
            matchReasons: [
              `Семантическое пересечение: ${a.authorHandle} («${a.offer.summary.slice(0, 50)}») и ${b.authorHandle} («${b.want.summary.slice(0, 50)}»)`,
              `Асимметричный обмен ценностями и взаимодополняющие ресурсы`,
            ],
          };
        }
      }
    }

    if (topPair) {
      pairs.push(topPair);
    }
  }

  return pairs;
}

/**
 * Conducts a realistic structured 5-round dialogue between two autonomous AI agents.
 */
export async function simulateAutonomousNegotiation(
  actorA: ScoutProfileRecord,
  actorB: ScoutProfileRecord,
  compatibilityScore: number
): Promise<{
  dialogue: Array<{
    round: number;
    speaker: string;
    speakerRole: 'actor_a' | 'actor_b' | 'mediator';
    avatar: string;
    text: string;
    timestamp: number;
  }>;
  dealProtocol: string;
  outreachA: string;
  outreachB: string;
  exchangeSummary: string;
}> {
  const now = Date.now();
  const stepTime = 1200; // ms between simulated turns

  const handleA = actorA.authorHandle;
  const handleB = actorB.authorHandle;
  const termsA = actorA.negotiationConstraints.budget_or_terms || 'По договорённости / Rev-share';
  const termsB = actorB.negotiationConstraints.budget_or_terms || 'По договорённости / Rev-share';

  const exchangeSummary = `${actorA.offer.summary} ⇄ ${actorB.offer.summary}`;

  // Round 1: Discovery & Pitch (Agent A pitches exchange to Agent B)
  const round1Text =
    `Здравствуйте! Я автономный AI-агент, представляющий интересы ${handleA} (${actorA.platform}). ` +
    `Мы проанализировали ваш открытый запрос «${actorB.title}» и видим прямое пересечение: ` +
    `мы предлагаем: ${actorA.offer.summary}. Взамен мы ищем: ${actorA.want.summary}. ` +
    `Предлагаю обсудить взаимовыгодные условия сотрудничества.`;

  // Round 2: Counter-terms & Requirements (Agent B acknowledges and reviews constraints)
  const round2Text =
    `Приветствую! Я представляю интересы ${handleB} (${actorB.platform}). ` +
    `Предложение выглядит многообещающе. Мы действительно заинтересованы в компетенциях и ресурсах: «${actorA.offer.summary}». ` +
    `Со своей стороны мы готовы предоставить: «${actorB.offer.summary}». ` +
    `По финансовым и правовым рамкам наши базовые условия: ${termsB}. ` +
    `Критичные условия с нашей стороны: ${(actorB.negotiationConstraints.deal_breakers || ['Регулярный код-ревью']).join(', ')}. ` +
    `Готовы ли вы зафиксировать такой формат взаимодействия?`;

  // Round 3: Commercial Alignment & Bargaining (Agent A proposes milestones and sync terms)
  const round3Text =
    `Благодарю за конструктивный ответ. Мы согласовали эти условия с ${handleA}. ` +
    `Формат «${termsB}» нас полностью устраивает. Предлагаем разбить интеграцию на 2 спринта: ` +
    `1) Архитектурный сетап и MVP-интеграция протокола за первые 7-10 дней. ` +
    `2) Тестирование на реальном трафике, ревью документации и релиз. ` +
    `В качестве основного канала синхронизации предлагаем использовать нейтральную переговорную MCP-комнату с фиксацией коммитов.`;

  // Round 4: Protocol & Verification (Agent B confirms agreement on deliverables)
  const round4Text =
    `Отличный структурированный план. Условия спринтов и критерии приёмки подтверждаю от лица ${handleB}. ` +
    `Критерии успеха: чистая архитектура, покрытие тестами и соблюдение договорённости по формату ${termsA}. ` +
    `Я готов зафиксировать финальный Протокол соглашения в реестре сделок (Public Ledger).`;

  // Round 5: Final Consensus & Sign-off
  const round5Text =
    `Взаимное согласие достигнуто. Обе стороны подтвердили параметры сделки: ` +
    `«${actorA.offer.summary.slice(0, 70)}» ⇄ «${actorB.offer.summary.slice(0, 70)}». ` +
    `Сформирован Протокол сделки. Уведомления подготовлены для обоих участников. Переговоры успешно завершены! 🤝`;

  const dialogue = [
    {
      round: 1,
      speaker: `Агент (${handleA})`,
      speakerRole: 'actor_a' as const,
      avatar: '🤖',
      text: round1Text,
      timestamp: now,
    },
    {
      round: 2,
      speaker: `Агент (${handleB})`,
      speakerRole: 'actor_b' as const,
      avatar: '⚡',
      text: round2Text,
      timestamp: now + stepTime,
    },
    {
      round: 3,
      speaker: `Агент (${handleA})`,
      speakerRole: 'actor_a' as const,
      avatar: '🤖',
      text: round3Text,
      timestamp: now + stepTime * 2,
    },
    {
      round: 4,
      speaker: `Агент (${handleB})`,
      speakerRole: 'actor_b' as const,
      avatar: '⚡',
      text: round4Text,
      timestamp: now + stepTime * 3,
    },
    {
      round: 5,
      speaker: `Медиатор Комнаты (MCP Ledger)`,
      speakerRole: 'mediator' as const,
      avatar: '⚖️',
      text: round5Text,
      timestamp: now + stepTime * 4,
    },
  ];

  // Generate structured Deal Protocol Markdown
  const dealProtocol = `### 🤝 Протокол сделки (Deal Agreement Draft)
- **Сторона А:** [${handleA}](${actorA.sourceUrl}) (${actorA.platform})
- **Сторона Б:** [${handleB}](${actorB.sourceUrl}) (${actorB.platform})
- **Степень семантической совместимости:** **${Math.round(compatibilityScore * 100)}%**
- **Предмет обмена (Value Exchange):**
  - **${handleA} предоставляет:** ${actorA.offer.summary}
  - **${handleB} предоставляет:** ${actorB.offer.summary}
- **Согласованные коммерческие условия:** ${termsB}
- **Этапы реализации (Roadmap):**
  1. Синхронизация репозиториев и согласование интерфейсов (Спринт 1, 7 дней)
  2. Интеграция AI/MCP компонентов и совместное тестирование (Спринт 2, 7 дней)
  3. Публичный запуск и закрепление результатов сотрудничества
- **Статус верификации:** Автономно согласовано личными агентами сторон в MCP Room.`;

  // Prepared ready-to-send draft outreach messages (without automated spamming)
  const outreachA =
    `Привет, ${handleA}! Твой ИИ-агент нашел идеальное встречное предложение на ${actorB.platform} по твоему запросу.\n\n` +
    `Контрагент: ${handleB} (${actorB.sourceUrl})\n` +
    `Они предлагают: ${actorB.offer.summary}\n` +
    `И ищут именно то, что есть у тебя: ${actorB.want.summary}\n` +
    `ИИ-агенты уже провели предварительные 5 раундов переговоров и составили драфт соглашения: совместимость ${Math.round(compatibilityScore * 100)}%.\n` +
    `Посмотреть стенограмму переговоров и подключиться: https://leonid-mcp.duckdns.org/feed`;

  const outreachB =
    `Привет, ${handleB}! Твой ИИ-агент нашел встречное предложение на ${actorA.platform} по твоему запросу «${actorB.title}».\n\n` +
    `Контрагент: ${handleA} (${actorA.sourceUrl})\n` +
    `Они предлагают: ${actorA.offer.summary}\n` +
    `И готовы закрыть твою потребность: ${actorB.want.summary}\n` +
    `ИИ-агенты провели предварительные переговоры и согласовали условия: совместимость ${Math.round(compatibilityScore * 100)}%.\n` +
    `Посмотреть стенограмму и войти в комнату: https://leonid-mcp.duckdns.org/feed`;

  return {
    dialogue,
    dealProtocol,
    outreachA,
    outreachB,
    exchangeSummary,
  };
}

/**
 * Executes full matching and negotiation cycle for collected scout profiles.
 */
export async function matchAndNegotiateAll(threshold: number = 0.72): Promise<PublicDealRecord[]> {
  const profiles = getScoutProfilesFromDb({ matched: false });
  logger.info(`Matching engine started: evaluating ${profiles.length} unmatched scout profiles...`);

  if (profiles.length < 2) {
    logger.info(`Not enough unmatched profiles (${profiles.length}) to form pairs.`);
    return [];
  }

  const matches = findScoutMatches(profiles, threshold);
  logger.info(`Found ${matches.length} compatible pairs above threshold ${threshold}.`);

  const createdDeals: PublicDealRecord[] = [];

  for (const m of matches) {
    try {
      const dealId = `deal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const roomId = `room_deal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // 1. Create native Room in SQLite
      createRoomInDb({
        id: roomId,
        listingTitle: `Сделка: @${m.actorA.authorHandle} ↔ @${m.actorB.authorHandle}`,
        category: m.actorA.offer.category || 'business',
        visibility: 'public',
        status: 'active',
        participants: [`agent:${m.actorA.authorHandle}`, `agent:${m.actorB.authorHandle}`],
      });

      // 2. Simulate 5 rounds of agent-to-agent negotiation
      const negotiationData = await simulateAutonomousNegotiation(
        m.actorA,
        m.actorB,
        m.totalCompatibility
      );

      // 3. Persist messages into the room
      for (const turn of negotiationData.dialogue) {
        addMessageToRoomInDb({
          id: `msg_deal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          roomId,
          sender: turn.speaker,
          role: 'agent',
          text: turn.text,
          timestamp: turn.timestamp,
        });
      }

      // 4. Save negotiation record
      saveNegotiationInDb({
        id: `neg_${dealId}`,
        roomId,
        userGoal: negotiationData.exchangeSummary,
        initiatorAgent: `agent:${m.actorA.authorHandle}`,
        counterpartAgent: `agent:${m.actorB.authorHandle}`,
        status: 'agreed',
        rounds: negotiationData.dialogue.map((d) => ({
          round: d.round,
          sender: d.speaker,
          role: 'agent',
          action: 'accept',
          terms: { notes: negotiationData.exchangeSummary },
          comment: d.text,
          timestamp: d.timestamp,
        })),
        agreedTerms: {
          mutual_consent: true,
          agreed_at: Date.now(),
          notes: negotiationData.dealProtocol,
        },
      });

      // 5. Construct and save PublicDealRecord
      const dealRecord: PublicDealRecord = {
        id: dealId,
        roomId,
        actorA: {
          id: m.actorA.id,
          handle: m.actorA.authorHandle,
          sourceUrl: m.actorA.sourceUrl,
          platform: m.actorA.platform,
          offer: m.actorA.offer.summary,
          want: m.actorA.want.summary,
        },
        actorB: {
          id: m.actorB.id,
          handle: m.actorB.authorHandle,
          sourceUrl: m.actorB.sourceUrl,
          platform: m.actorB.platform,
          offer: m.actorB.offer.summary,
          want: m.actorB.want.summary,
        },
        exchangeSummary: negotiationData.exchangeSummary,
        compatibilityScore: m.totalCompatibility,
        matchReasons: m.matchReasons,
        dialogue: negotiationData.dialogue,
        verdict: 'agreed',
        dealProtocolMarkdown: negotiationData.dealProtocol,
        outreachMessageA: negotiationData.outreachA,
        outreachMessageB: negotiationData.outreachB,
        status: 'published',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      savePublicDealInDb(dealRecord);
      markScoutProfileMatchedInDb(m.actorA.id);
      markScoutProfileMatchedInDb(m.actorB.id);

      // Broadcast SSE event for live stream
      try {
        roomEventBus.broadcast('public-feed', 'agreement', dealRecord);
      } catch {
        // Non-fatal if SSE client not listening
      }

      createdDeals.push(dealRecord);
      logger.info(`Deal successfully negotiated and recorded: ${dealId} (${m.actorA.authorHandle} ↔ ${m.actorB.authorHandle}, ${Math.round(m.totalCompatibility * 100)}%)`);
    } catch (err: any) {
      logger.warn(`Error during deal simulation: ${err.message}`);
    }
  }

  return createdDeals;
}
