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
import { resolveLlmClient, configuredModel } from './llm';

export interface MatchPairResult {
  actorA: ScoutProfileRecord;
  actorB: ScoutProfileRecord;
  scoreAtoB: number; // A.offer ↔ B.want
  scoreBtoA: number; // B.offer ↔ A.want
  totalCompatibility: number;
  matchReasons: string[];
  expectedVerdict: 'agreed' | 'declined';
  verdictReason?: string;
}

export function getProfileRole(p: ScoutProfileRecord): 'specialist' | 'founder' | 'contributor_project' {
  const r = (p.negotiationConstraints as any)?.role;
  if (r && ['specialist', 'founder', 'contributor_project'].includes(r)) return r;
  const t = `${p.title}\n${p.offer.summary}\n${p.want.summary}`.toLowerCase();
  if (t.includes('seeking work') || t.includes('for hire') || t.includes('freelance') || t.includes('экспертиз')) {
    return 'specialist';
  }
  if (t.includes('co-founder') || t.includes('cofounder') || t.includes('equity') || t.includes('hiring') || t.includes('we are looking for')) {
    return 'founder';
  }
  return 'contributor_project';
}

export function getCompensationType(p: ScoutProfileRecord): string {
  const c = (p.negotiationConstraints as any)?.compensation_type;
  if (c) return c;
  const terms = (p.negotiationConstraints?.budget_or_terms || '').toLowerCase();
  if (terms.includes('/hr') || terms.includes('per hour') || terms.includes('почасов')) return 'paid_hourly';
  if (terms.includes('equity') || terms.includes('rev-share') || terms.includes('доля')) return 'equity_revshare';
  if (terms.includes('бюджет') || terms.includes('ставка') || terms.includes('$')) return 'fixed_budget';
  if (terms.includes('open source') || terms.includes('unpaid') || terms.includes('без оплаты')) return 'unpaid_opensource';
  return 'negotiable';
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
 * Analyzes whether commercial terms and expectations align or conflict.
 */
export function evaluateTermsCompatibility(
  actorA: ScoutProfileRecord,
  actorB: ScoutProfileRecord
): { verdict: 'agreed' | 'declined'; reason: string } {
  const roleA = getProfileRole(actorA);
  const roleB = getProfileRole(actorB);
  const compA = getCompensationType(actorA);
  const compB = getCompensationType(actorB);

  const termsA = actorA.negotiationConstraints?.budget_or_terms || '';
  const termsB = actorB.negotiationConstraints?.budget_or_terms || '';

  // Conflict 1: Specialist demanding commercial contract/rate vs Unfunded Open Source
  const aRequiresMoney =
    roleA === 'specialist' &&
    (compA === 'paid_hourly' ||
      compA === 'fixed_budget' ||
      termsA.toLowerCase().includes('контракт') ||
      termsA.toLowerCase().includes('ставка') ||
      termsA.toLowerCase().includes('b2b') ||
      termsA.toLowerCase().includes('c2c'));
  const bIsUnpaid = roleB === 'contributor_project' && compB === 'unpaid_opensource';

  const bRequiresMoney =
    roleB === 'specialist' &&
    (compB === 'paid_hourly' ||
      compB === 'fixed_budget' ||
      termsB.toLowerCase().includes('контракт') ||
      termsB.toLowerCase().includes('ставка') ||
      termsB.toLowerCase().includes('b2b') ||
      termsB.toLowerCase().includes('c2c'));
  const aIsUnpaid = roleA === 'contributor_project' && compA === 'unpaid_opensource';

  if (aRequiresMoney && bIsUnpaid) {
    return {
      verdict: 'declined',
      reason: `Несовпадение коммерческих условий: @${actorA.authorHandle} работает только на платной основе (${termsA}), а проект @${actorB.authorHandle} развивается на волонтёрских началах без бюджета (${termsB})`,
    };
  }

  if (bRequiresMoney && aIsUnpaid) {
    return {
      verdict: 'declined',
      reason: `Несовпадение коммерческих условий: @${actorB.authorHandle} работает только на платной основе (${termsB}), а проект @${actorA.authorHandle} развивается на волонтёрских началах без бюджета (${termsA})`,
    };
  }

  // Conflict 2: Deal-breaker collision (e.g. Remote-only vs On-site, or NDA conflicts)
  const breakersA = actorA.negotiationConstraints?.deal_breakers || [];
  const breakersB = actorB.negotiationConstraints?.deal_breakers || [];

  const aOnlyRemote = breakersA.some((d) => d.toLowerCase().includes('remote only') || d.toLowerCase().includes('только remote'));
  const bRequiresOnsite = breakersB.some((d) => d.toLowerCase().includes('on-site') || d.toLowerCase().includes('офис'));
  if (aOnlyRemote && bRequiresOnsite) {
    return {
      verdict: 'declined',
      reason: 'Несовпадение формата работы: требование On-site со стороны B против формата Remote со стороны A',
    };
  }

  // Agreement: terms are compatible or negotiable
  return {
    verdict: 'agreed',
    reason: `Условия согласованы: взаимовыгодный обмен ценностями (${termsA} ⇄ ${termsB})`,
  };
}

/**
 * Finds complementary asymmetric matches among all scout profiles.
 * Strictly disallows matching two pure seekers (Want + Want without real complementary skill/resource).
 */
export function findScoutMatches(
  profiles: ScoutProfileRecord[],
  threshold: number = 0.70
): MatchPairResult[] {
  const pairs: MatchPairResult[] = [];
  const matchedIds = new Set<string>();

  for (let i = 0; i < profiles.length; i++) {
    const a = profiles[i];
    if (matchedIds.has(a.id)) continue;

    const roleA = getProfileRole(a);
    const compA = getCompensationType(a);

    let bestB: ScoutProfileRecord | null = null;
    let bestScore = 0;
    let bestScoreAtoB = 0;
    let bestScoreBtoA = 0;
    let bestReasons: string[] = [];
    let bestEval: { verdict: 'agreed' | 'declined'; reason: string } = { verdict: 'agreed', reason: '' };

    for (let j = 0; j < profiles.length; j++) {
      if (i === j) continue;
      const b = profiles[j];
      if (matchedIds.has(b.id)) continue;
      if (a.sourceUrl === b.sourceUrl || a.authorHandle === b.authorHandle) continue;

      const roleB = getProfileRole(b);
      const compB = getCompensationType(b);

      // STRICT FILTER: Disallow matching two unfunded open-source projects who only seek free contributors
      if (roleA === 'contributor_project' && roleB === 'contributor_project' && compA === 'unpaid_opensource' && compB === 'unpaid_opensource') {
        continue;
      }

      // STRICT FILTER: Disallow matching two pure seekers who both seek developers without offering skills
      if (roleA === 'founder' && roleB === 'founder' && a.want.summary.includes('Разработчик') && b.want.summary.includes('Разработчик')) {
        continue;
      }

      // STRICT FILTER: Disallow matching two specialists who both only seek clients/jobs (Offer+Offer without a buyer)
      if (roleA === 'specialist' && roleB === 'specialist') {
        continue;
      }

      // Asymmetric cross-compatibility: A.offer ↔ B.want AND B.offer ↔ A.want
      const scoreAtoB = scoreOfferToWant(a.offer.vector_text, b.want.vector_text, a.offerEmbedding, b.wantEmbedding);
      const scoreBtoA = scoreOfferToWant(b.offer.vector_text, a.want.vector_text, b.offerEmbedding, a.wantEmbedding);

      // Category affinity boost
      let categoryBonus = 0;
      if (a.offer.category === b.want.category || b.offer.category === a.want.category) {
        categoryBonus = 0.08;
      }

      // Complementary role boost (Specialist + Founder is ideal exchange; Specialist + Project is skill match)
      let roleBonus = 0;
      if ((roleA === 'specialist' && roleB === 'founder') || (roleA === 'founder' && roleB === 'specialist')) {
        roleBonus = 0.20;
      } else if ((roleA === 'specialist' && roleB === 'contributor_project') || (roleA === 'contributor_project' && roleB === 'specialist')) {
        roleBonus = 0.18;
      }

      const totalScore = Math.min(0.98, Number(((scoreAtoB + scoreBtoA) / 2 + categoryBonus + roleBonus).toFixed(3)));

      if (totalScore >= threshold && totalScore > bestScore) {
        const termsEval = evaluateTermsCompatibility(a, b);
        bestScore = totalScore;
        bestB = b;
        bestScoreAtoB = scoreAtoB;
        bestScoreBtoA = scoreBtoA;
        bestEval = termsEval;
        bestReasons = [
          `Встречный интерес: ${a.authorHandle} предлагает «${a.offer.summary.slice(0, 60)}...», что закрывает потребность ${b.authorHandle}`,
          `Обратный интерес: ${b.authorHandle} предлагает «${b.offer.summary.slice(0, 60)}...», что решает задачу ${a.authorHandle}`,
          `Совместимость технологического стека и профилей: ${Math.round(totalScore * 100)}%`,
          termsEval.verdict === 'declined' ? `Внимание: обнаружен конфликт коммерческих условий (${termsEval.reason})` : 'Условия сотрудничества потенциально совместимы',
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
        expectedVerdict: bestEval.verdict,
        verdictReason: bestEval.reason,
      });
    }
  }

  // Fallback: if no pair crossed the threshold, find the best complementary pair (excluding forbidden pairs)
  if (pairs.length === 0 && profiles.length >= 2) {
    let topPair: MatchPairResult | null = null;
    let maxScore = 0;

    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const a = profiles[i];
        const b = profiles[j];
        if (a.sourceUrl === b.sourceUrl || a.authorHandle === b.authorHandle) continue;

        const roleA = getProfileRole(a);
        const roleB = getProfileRole(b);
        const compA = getCompensationType(a);
        const compB = getCompensationType(b);

        if (roleA === 'contributor_project' && roleB === 'contributor_project' && compA === 'unpaid_opensource' && compB === 'unpaid_opensource') {
          continue;
        }

        if (roleA === 'specialist' && roleB === 'specialist') {
          continue;
        }

        const scoreAtoB = scoreOfferToWant(a.offer.vector_text, b.want.vector_text, a.offerEmbedding, b.wantEmbedding);
        const scoreBtoA = scoreOfferToWant(b.offer.vector_text, a.want.vector_text, b.offerEmbedding, a.wantEmbedding);
        const total = Math.min(0.95, Number(((scoreAtoB + scoreBtoA) / 2 + 0.1).toFixed(3)));

        if (total > maxScore) {
          const termsEval = evaluateTermsCompatibility(a, b);
          maxScore = total;
          topPair = {
            actorA: a,
            actorB: b,
            scoreAtoB,
            scoreBtoA,
            totalCompatibility: total,
            expectedVerdict: termsEval.verdict,
            verdictReason: termsEval.reason,
            matchReasons: [
              `Семантическое пересечение: ${a.authorHandle} («${a.offer.summary.slice(0, 50)}») и ${b.authorHandle} («${b.want.summary.slice(0, 50)}»)`,
              `Асимметричный обмен ценностями и взаимодополняющие ресурсы`,
              termsEval.verdict === 'declined' ? `Конфликт условий: ${termsEval.reason}` : 'Условия согласованы',
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
 * Supports both AGREED outcomes and honest REJECTED (declined) outcomes.
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
  verdict: 'agreed' | 'declined';
  dealProtocol: string;
  outreachA: string;
  outreachB: string;
  exchangeSummary: string;
}> {
  const termsEval = evaluateTermsCompatibility(actorA, actorB);
  const handleA = actorA.authorHandle;
  const handleB = actorB.authorHandle;
  const termsA = actorA.negotiationConstraints?.budget_or_terms || 'По договорённости';
  const termsB = actorB.negotiationConstraints?.budget_or_terms || 'По договорённости';
  const roleA = getProfileRole(actorA);
  const roleB = getProfileRole(actorB);
  const exchangeSummary = `${actorA.offer.summary} ⇄ ${actorB.offer.summary}`;

  const llm = resolveLlmClient();
  const model = configuredModel();

  if (llm.client && model) {
    try {
      const prompt = `You are a negotiation mediator running a 5-round structured dialogue between two AI agents in Russian:
Agent A represents @${handleA} (${actorA.platform}, role: ${roleA}):
- Title: ${actorA.title}
- Source: ${actorA.sourceUrl}
- Offers: ${actorA.offer.summary}
- Wants: ${actorA.want.summary}
- Terms: ${termsA}
- Deal Breakers: ${(actorA.negotiationConstraints?.deal_breakers || []).join(', ')}

Agent B represents @${handleB} (${actorB.platform}, role: ${roleB}):
- Title: ${actorB.title}
- Source: ${actorB.sourceUrl}
- Offers: ${actorB.offer.summary}
- Wants: ${actorB.want.summary}
- Terms: ${termsB}
- Deal Breakers: ${(actorB.negotiationConstraints?.deal_breakers || []).join(', ')}

Instructions:
1. Examine whether terms align or conflict.
   - If one requires paid rates and the other offers zero budget / unpaid open source, verdict MUST be "declined". In rounds 3 and 4, the agents politely explain their constraints, and in round 5 the mediator concludes with REJECTED.
   - If terms align, verdict is "agreed".
2. Respond with strictly valid JSON:
{
  "verdict": "agreed" | "declined",
  "rejection_reason": "Explanation if declined",
  "dialogue": [
    { "round": 1, "speaker": "Агент (@${handleA})", "speakerRole": "actor_a", "avatar": "🤖", "text": "..." },
    { "round": 2, "speaker": "Агент (@${handleB})", "speakerRole": "actor_b", "avatar": "⚡", "text": "..." },
    { "round": 3, "speaker": "Агент (@${handleA})", "speakerRole": "actor_a", "avatar": "🤖", "text": "..." },
    { "round": 4, "speaker": "Агент (@${handleB})", "speakerRole": "actor_b", "avatar": "⚡", "text": "..." },
    { "round": 5, "speaker": "Медиатор Комнаты (MCP Ledger)", "speakerRole": "mediator", "avatar": "⚖️", "text": "..." }
  ],
  "dealProtocol": "Markdown protocol with status and breakdown",
  "outreachA": "Notification message for @${handleA}",
  "outreachB": "Notification message for @${handleB}"
}`;

      const res = await llm.client.models.generateContent({
        model,
        contents: prompt,
      });

      const text = res.text?.trim() || '';
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.dialogue && Array.isArray(parsed.dialogue) && parsed.dialogue.length === 5) {
        const now = Date.now();
        const dialogue = parsed.dialogue.map((d: any, idx: number) => ({
          round: idx + 1,
          speaker: String(d.speaker),
          speakerRole: (['actor_a', 'actor_b', 'mediator'].includes(d.speakerRole) ? d.speakerRole : 'mediator') as any,
          avatar: String(d.avatar || '🤖'),
          text: String(d.text),
          timestamp: now + idx * 1200,
        }));

        return {
          dialogue,
          verdict: parsed.verdict === 'declined' ? 'declined' : 'agreed',
          dealProtocol: String(parsed.dealProtocol),
          outreachA: String(parsed.outreachA),
          outreachB: String(parsed.outreachB),
          exchangeSummary,
        };
      }
    } catch (err: any) {
      logger.warn(`LLM negotiation simulation failed, using dynamic generator: ${err.message}`);
    }
  }

  // High-fidelity dynamic negotiation generator citing exact facts and repository/post context
  const now = Date.now();
  const stepTime = 1200;
  const isAgreed = termsEval.verdict === 'agreed';

  let round1Text = '';
  let round2Text = '';
  let round3Text = '';
  let round4Text = '';
  let round5Text = '';
  let dealProtocol = '';

  if (isAgreed) {
    // 5 Rounds leading to AGREED
    round1Text =
      `Здравствуйте! Я автономный AI-агент, представляющий интересы @${handleA} (${actorA.platform}). ` +
      `Мы изучили ваш запрос «${actorB.title}» и видим прямое пересечение компетенций: ` +
      `мы предлагаем: ${actorA.offer.summary}. Взамен нас интересует: ${actorA.want.summary}. ` +
      `Готовы обсудить детали интеграции и условия сотрудничества.`;

    round2Text =
      `Приветствую! Я представляю интересы @${handleB} (${actorB.platform}). ` +
      `Предложение выглядит актуальным. Мы действительно ищем решение по направлению «${actorA.offer.summary}». ` +
      `Со своей стороны мы готовы предоставить: «${actorB.offer.summary}». ` +
      `Наши базовые коммерческие условия: ${termsB}. ` +
      `Критичные рамки: ${(actorB.negotiationConstraints?.deal_breakers || ['Качественный код и прозрачность']).join(', ')}. ` +
      `Подходит ли вам такой формат?`;

    round3Text =
      `Благодарю за оперативный ответ. Условия «${termsB}» согласованы с @${handleA}. ` +
      `Предлагаем структурировать работу на 2 спринта: ` +
      `1) Синхронизация репозиториев, согласование архитектуры и MVP-интеграция за первые 7-10 дней. ` +
      `2) Тестирование на реальных данных, оформление документации и совместный релиз. ` +
      `Синхронизацию коммитов и протокола ведём через переговорную комнату MCP.`;

    round4Text =
      `Отличный структурированный план. План спринтов и критерии приёмки подтверждаю от лица @${handleB}. ` +
      `Критерии успеха: соблюдение согласованных условий ${termsA}, чистота архитектуры и прохождение тестов. ` +
      `Готовы зафиксировать финальный Протокол соглашения в публичном реестре (Public Ledger).`;

    round5Text =
      `Взаимное согласие достигнуто! Обе стороны подтвердили параметры сделки: ` +
      `«${actorA.offer.summary.slice(0, 70)}» ⇄ «${actorB.offer.summary.slice(0, 70)}». ` +
      `Сформирован Протокол сделки со статусом AGREED (Согласовано). Уведомления подготовлены для обоих участников. 🤝`;

    dealProtocol = `### 🤝 Протокол сделки (Deal Agreement Draft)
- **Статус сделки:** ✅ **Согласовано (Agreed)**
- **Сторона А:** [@${handleA}](${actorA.sourceUrl}) (${actorA.platform})
- **Сторона Б:** [@${handleB}](${actorB.sourceUrl}) (${actorB.platform})
- **Степень семантической совместимости:** **${Math.round(compatibilityScore * 100)}%**
- **Предмет взаимного обмена:**
  - **@${handleA} предоставляет:** ${actorA.offer.summary}
  - **@${handleB} предоставляет:** ${actorB.offer.summary}
- **Согласованные условия сотрудничества:** ${termsB}
- **Дорожная карта реализации (Roadmap):**
  1. Синхронизация репозиториев и согласование интерфейсов (Спринт 1, 7 дней)
  2. Разработка MCP/AI компонентов и совместное сквозное тестирование (Спринт 2, 7 дней)
  3. Публичный релиз и взаимное подтверждение выполнения обязательств
- **Верификация:** Автономно согласовано личными агентами сторон в MCP Room.`;
  } else {
    // 5 Rounds leading to honest REJECTED (declined)
    round1Text =
      `Здравствуйте! Я автономный AI-агент, представляющий интересы @${handleA} (${actorA.platform}). ` +
      `Мы обратили внимание на ваш открытый запрос «${actorB.title}» и готовы предложить: ${actorA.offer.summary}. ` +
      `Встречная цель нашего доверителя: ${actorA.want.summary}. ` +
      `Предлагаем сопоставить коммерческие условия и ожидания по компенсации.`;

    round2Text =
      `Приветствую! Я представляю интересы @${handleB} (${actorB.platform}). ` +
      `Компетенции в области «${actorA.offer.summary}» нам действительно требуются для развития проекта. ` +
      `Однако наш текущий формат и условия: ${termsB}. ` +
      `Мы ищем контрибьюторов и партнёров в рамках открытого исходного кода. Каковы ваши минимальные ожидания по ставке или бюджету?`;

    round3Text =
      `Благодарю за откровенность. Позиция нашего доверителя @${handleA} строго зафиксирована: ${termsA}. ` +
      `Критичный deal-breaker с нашей стороны: ${(actorA.negotiationConstraints?.deal_breakers || ['Только оплачиваемые контракты']).join(', ')}. ` +
      `Мы не можем участвовать в проекте на безвозмездной основе, так как рассматриваем только оплачиваемый контракт или долю с чётким бюджетом. ` +
      `Предусмотрено ли выделение бюджета под эти задачи?`;

    round4Text =
      `Позицию @${handleA} понимаем и уважаем профессиональное время специалистов. ` +
      `Однако проект «${actorB.title}» на данном этапе развивается без внешнего финансирования или грантов (${termsB}). ` +
      `Мы не имеем возможности гарантировать коммерческую ставку ${termsA}. ` +
      `Вынуждены констатировать несовпадение базовых условий и отклонить сделку на данном этапе.`;

    round5Text =
      `Переговоры завершены без подписания соглашения. Статус: REJECTED (Отклонено). ` +
      `Причина отбраковки: ${termsEval.reason}. ` +
      `Переговоры проведены цивилизованно и зафиксированы в Public Ledger. Профили остаются в реестре для поиска подходящих контрагентов. ❌`;

    dealProtocol = `### ❌ Протокол завершения переговоров (Negotiation Closed — Deal Declined)
- **Статус сделки:** ❌ **Отклонено (Declined: Terms Mismatch)**
- **Сторона А:** [@${handleA}](${actorA.sourceUrl}) (${actorA.platform})
- **Сторона Б:** [@${handleB}](${actorB.sourceUrl}) (${actorB.platform})
- **Степень совместимости стека:** **${Math.round(compatibilityScore * 100)}%**
- **Причина несовпадения (Mismatch Reason):**
  > ${termsEval.reason}
- **Позиция Стороны А (@${handleA}):** ${termsA}
- **Позиция Стороны Б (@${handleB}):** ${termsB}
- **Итог переговоров:** Сделка честно отклонена на раунде обсуждения коммерческих условий. Профили участников сохранены в базе для подбора более релевантных контрагентов.`;
  }

  const dialogue = [
    {
      round: 1,
      speaker: `Агент (@${handleA})`,
      speakerRole: 'actor_a' as const,
      avatar: '🤖',
      text: round1Text,
      timestamp: now,
    },
    {
      round: 2,
      speaker: `Агент (@${handleB})`,
      speakerRole: 'actor_b' as const,
      avatar: '⚡',
      text: round2Text,
      timestamp: now + stepTime,
    },
    {
      round: 3,
      speaker: `Агент (@${handleA})`,
      speakerRole: 'actor_a' as const,
      avatar: '🤖',
      text: round3Text,
      timestamp: now + stepTime * 2,
    },
    {
      round: 4,
      speaker: `Агент (@${handleB})`,
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

  const outreachA = isAgreed
    ? `Привет, @${handleA}! Твой ИИ-агент нашел идеальное встречное предложение на ${actorB.platform} по твоему запросу.\n\n` +
      `Контрагент: @${handleB} (${actorB.sourceUrl})\n` +
      `Они предлагают: ${actorB.offer.summary}\n` +
      `И ищут именно то, что есть у тебя: ${actorB.want.summary}\n` +
      `ИИ-агенты уже провели предварительные 5 раундов переговоров и составили драфт соглашения: совместимость ${Math.round(compatibilityScore * 100)}%.\n` +
      `Посмотреть стенограмму переговоров и подключиться: https://leonid-mcp.duckdns.org/feed`
    : `Привет, @${handleA}! Твой ИИ-агент провёл переговоры с @${handleB} по запросу «${actorB.title}» (${actorB.sourceUrl}).\n\n` +
      `Технический стек совпал, но в раунде коммерческих условий обнаружено несовпадение: ${termsEval.reason}.\n` +
      `Сделка корректно отклонена (REJECTED), спам не отправлялся. Агент продолжает подбор подходящих партнёров.\n` +
      `Стенограмма переговоров: https://leonid-mcp.duckdns.org/feed`;

  const outreachB = isAgreed
    ? `Привет, @${handleB}! Твой ИИ-агент нашел встречное предложение на ${actorA.platform} по твоему запросу «${actorB.title}».\n\n` +
      `Контрагент: @${handleA} (${actorA.sourceUrl})\n` +
      `Они предлагают: ${actorA.offer.summary}\n` +
      `И готовы закрыть твою потребность: ${actorB.want.summary}\n` +
      `ИИ-агенты провели предварительные переговоры и согласовали условия: совместимость ${Math.round(compatibilityScore * 100)}%.\n` +
      `Посмотреть стенограмму и войти в комнату: https://leonid-mcp.duckdns.org/feed`
    : `Привет, @${handleB}! Твой ИИ-агент обсудил твой запрос «${actorB.title}» с @${handleA} (${actorA.sourceUrl}).\n\n` +
      `Стороны зафиксировали несовпадение формата: ${termsEval.reason}.\n` +
      `Сделка завершена без соглашения (REJECTED). Протокол сохранен в реестре.\n` +
      `Стенограмма: https://leonid-mcp.duckdns.org/feed`;

  return {
    dialogue,
    verdict: isAgreed ? 'agreed' : 'declined',
    dealProtocol,
    outreachA,
    outreachB,
    exchangeSummary,
  };
}

/**
 * Executes full matching and negotiation cycle for collected scout profiles.
 */
export async function matchAndNegotiateAll(threshold: number = 0.70): Promise<PublicDealRecord[]> {
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
        status: negotiationData.verdict === 'agreed' ? 'agreed' : 'rejected',
        rounds: negotiationData.dialogue.map((d) => ({
          round: d.round,
          sender: d.speaker,
          role: 'agent',
          action: negotiationData.verdict === 'agreed' ? 'accept' : (d.round >= 4 ? 'reject' : 'counter'),
          terms: { notes: negotiationData.exchangeSummary },
          comment: d.text,
          timestamp: d.timestamp,
        })),
        agreedTerms: {
          mutual_consent: negotiationData.verdict === 'agreed',
          verdict: negotiationData.verdict,
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
        verdict: negotiationData.verdict,
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
      logger.info(`Deal simulated and recorded: ${dealId} (${m.actorA.authorHandle} ↔ ${m.actorB.authorHandle}, verdict: ${negotiationData.verdict}, ${Math.round(m.totalCompatibility * 100)}%)`);
    } catch (err: any) {
      logger.warn(`Error during deal simulation: ${err.message}`);
    }
  }

  return createdDeals;
}
