import { RawScoutItem } from './scout';
import { ScoutProfileRecord, saveScoutProfileInDb } from './db';
import { computeEmbedding } from './embeddings';
import { logger } from './logger';
import { resolveLlmClient, configuredModel } from './llm';

export type ParticipantRole =
  | 'specialist' // talent offering skills, code, architecture
  | 'founder' // founder / startup offering equity, budget, product MVP, seeking talent/partner
  | 'contributor_project'; // open source / community seeking maintainers / contributors

export type CompensationType =
  | 'paid_hourly'
  | 'fixed_budget'
  | 'equity_revshare'
  | 'unpaid_opensource'
  | 'negotiable';

export interface ExtractedParticipant {
  isValidDealCandidate: boolean;
  rejectReason?: string;
  role: ParticipantRole;
  compensationType: CompensationType;
  offer: {
    summary: string;
    category: string;
    vector_text: string;
  };
  want: {
    summary: string;
    category: string;
    urgency: 'high' | 'medium' | 'low';
    vector_text: string;
  };
  negotiation_constraints: {
    budget_or_terms: string;
    compensation_type: CompensationType;
    role: ParticipantRole;
    deal_breakers: string[];
  };
}

/**
 * Checks whether an item is a bug report, error log, crash report, support question, or chore.
 * Returns the rejection reason if invalid, or null if it appears to be a genuine collaboration post.
 */
export function classifyCandidateRejection(item: RawScoutItem): string | null {
  const title = (item.title || '').trim();
  const body = (item.body || '').trim();
  const fullText = `${title}\n${body}`.toLowerCase();

  // 1. Check title prefixes and patterns for bugs/fixes/chores
  const bugPrefixRegex = /^(bug|fix|crash|error|exception|panic|segfault|flaky|typo|chore|ci|test|bump|regression|hotfix|security|cve-)(\s*[:\(\[/\-]|\s+)/i;
  if (bugPrefixRegex.test(title)) {
    return `Technical bug report or chore prefix: "${title.slice(0, 60)}"`;
  }

  // 2. Common bug report title markers
  if (
    title.includes('crashes') ||
    title.includes('crash on') ||
    title.includes('failed to') ||
    title.includes('fails to') ||
    title.includes('not working') ||
    title.includes('TypeError:') ||
    title.includes('SyntaxError:') ||
    title.includes('NullPointerException') ||
    title.includes('undefined is not') ||
    title.includes('memory leak')
  ) {
    return `Title indicates crash or defect: "${title.slice(0, 60)}"`;
  }

  // 3. Issue templates with reproduction steps or logs
  if (
    body.includes('### Steps to reproduce') ||
    body.includes('### Expected behavior') ||
    body.includes('### Actual behavior') ||
    body.includes('### Reproduction') ||
    body.includes('Traceback (most recent call last)') ||
    body.includes('at Object.<anonymous>')
  ) {
    return 'Content matches standard bug report template or stack trace';
  }

  // 4. GitHub labels indicating bugs
  if (Array.isArray(item.tags)) {
    const lowerTags = item.tags.map((t) => t.toLowerCase());
    if (
      lowerTags.includes('bug') ||
      lowerTags.includes('duplicate') ||
      lowerTags.includes('invalid') ||
      lowerTags.includes('wontfix') ||
      lowerTags.includes('dependencies')
    ) {
      return `GitHub label indicates defect: ${item.tags.join(', ')}`;
    }
  }

  // 5. Questions and general user support (where author offers nothing)
  if (
    (title.toLowerCase().startsWith('how to') ||
      title.toLowerCase().startsWith('why does') ||
      title.toLowerCase().startsWith('is there any way') ||
      title.toLowerCase().startsWith('question:')) &&
    !fullText.includes('hiring') &&
    !fullText.includes('seeking work') &&
    !fullText.includes('co-founder') &&
    !fullText.includes('cofounder')
  ) {
    return 'Author is asking a user support question without offering partnership';
  }

  return null;
}

/**
 * Intelligent deterministic NLP extractor that parses raw unstructured requests
 * into strict Offer / Want JSON schema with honest classification.
 */
export function extractHeuristicProfile(item: RawScoutItem): ExtractedParticipant {
  const fullText = `${item.title}\n${item.body}`.trim();
  const lower = fullText.toLowerCase();

  // 1. Initial rejection filter
  const rejectReason = classifyCandidateRejection(item);
  if (rejectReason) {
    return {
      isValidDealCandidate: false,
      rejectReason,
      role: 'contributor_project',
      compensationType: 'unpaid_opensource',
      offer: { summary: '', category: 'other', vector_text: '' },
      want: { summary: '', category: 'other', urgency: 'low', vector_text: '' },
      negotiation_constraints: {
        budget_or_terms: 'None',
        compensation_type: 'unpaid_opensource',
        role: 'contributor_project',
        deal_breakers: [],
      },
    };
  }

  // 2. Classify intent: Specialist (Talent) vs Founder (Looking for partner/dev) vs Project (Seeking contributors)
  const isSeekingWork =
    lower.includes('seeking work') ||
    lower.includes('[for hire]') ||
    lower.includes('for hire') ||
    lower.includes('who wants to be hired') ||
    lower.includes('available for hire') ||
    lower.includes('available for freelance') ||
    lower.includes('freelance developer') ||
    lower.includes('portfolio:') ||
    lower.includes('my portfolio') ||
    lower.includes('github.com/') && (lower.includes('senior') || lower.includes('engineer') || lower.includes('full stack'));

  const isCoFounder =
    lower.includes('co-founder') ||
    lower.includes('cofounder') ||
    lower.includes('looking for co-founder') ||
    lower.includes('seeking co-founder') ||
    lower.includes('technical partner') ||
    lower.includes('gtm partner') ||
    lower.includes('r/cofounder');

  const isHiring =
    lower.includes('who is hiring') ||
    lower.includes('[hiring]') ||
    lower.includes('we are hiring') ||
    lower.includes('looking for developer') ||
    lower.includes('looking for engineer') ||
    lower.includes('looking for maintainer');

  let role: ParticipantRole = 'contributor_project';
  if (isSeekingWork && !isHiring) {
    role = 'specialist';
  } else if (isCoFounder || isHiring) {
    role = 'founder';
  }

  // 3. Category Detection
  let category = 'business';
  if (lower.includes('mcp') || lower.includes('model context protocol') || lower.includes('agent') || lower.includes('sdk')) {
    category = 'services';
  } else if (isCoFounder || lower.includes('startup') || lower.includes('equity') || lower.includes('gtm')) {
    category = 'business';
  } else if (role === 'specialist' || isHiring || lower.includes('rate') || lower.includes('salary')) {
    category = 'jobs';
  } else {
    category = 'communities';
  }

  // 4. Honest Terms & Budget Extraction (strictly from facts)
  let compensationType: CompensationType = 'negotiable';
  let budgetOrTerms = 'По договорённости';

  const hourlyMatch = fullText.match(/\$\s*(\d{2,3})(\s*-\s*\$?\d{2,3})?\s*(\/|per)\s*(hr|hour)/i);
  const fixedMatch = fullText.match(/(\$\s*\d+[\d,]*\b|\b\d+k?\s*(usd|eur|rub|руб)\b)/i);
  const hasEquity = lower.includes('equity') || lower.includes('доля') || lower.includes('rev-share') || lower.includes('revshare');
  const hasContractKeyword =
    lower.includes('contract') ||
    lower.includes('c2c') ||
    lower.includes('freelance') ||
    lower.includes('b2b') ||
    lower.includes('hourly') ||
    lower.includes('rate') ||
    lower.includes('seeking work') ||
    lower.includes('seeking contract work') ||
    lower.includes('for hire');

  if (hourlyMatch) {
    compensationType = 'paid_hourly';
    budgetOrTerms = `Почасовая ставка: ${hourlyMatch[0].trim()}`;
  } else if (hasEquity) {
    compensationType = 'equity_revshare';
    budgetOrTerms = 'Equity / Rev-share (долевое участие)';
  } else if (fixedMatch && (lower.includes('budget') || lower.includes('bounty') || lower.includes('compensation') || lower.includes('pay') || lower.includes('ставка') || lower.includes('salary'))) {
    compensationType = 'fixed_budget';
    budgetOrTerms = `Бюджет / ставка: ${fixedMatch[0].trim()}`;
  } else if (role === 'specialist' && hasContractKeyword) {
    compensationType = 'paid_hourly';
    budgetOrTerms = 'Коммерческий контракт / Почасовая ставка (B2B / C2C)';
  } else if (role === 'contributor_project' || lower.includes('open source') || lower.includes('contribute') || lower.includes('help wanted')) {
    if (lower.includes('bounty') || lower.includes('grant') || lower.includes('reward')) {
      compensationType = 'fixed_budget';
      budgetOrTerms = 'Open Source Bounty / Грант за реализацию';
    } else {
      compensationType = 'unpaid_opensource';
      budgetOrTerms = 'Open Source контрибьютинг (без оплаты / pro bono)';
    }
  }

  // 5. Deal Breakers & Constraints
  const dealBreakers: string[] = [];
  if (lower.includes('remote only') || lower.includes('remote') || lower.includes('удален')) {
    dealBreakers.push('Только Remote (удалённый формат сотрудничества)');
  }
  if (lower.includes('no agencies') || lower.includes('no recruiters')) {
    dealBreakers.push('Без агентств и сторонних рекрутеров');
  }
  if (lower.includes('nda') || lower.includes('ip transfer')) {
    dealBreakers.push('Требуется подписание NDA и передача прав на код');
  }
  if (role === 'specialist' && compensationType === 'paid_hourly') {
    dealBreakers.push('Только оплачиваемые контракты (не volunteer)');
  }
  if (dealBreakers.length === 0) {
    dealBreakers.push('Прозрачная архитектура, чёткие майлстоуны и соблюдение сроков');
  }

  // 6. Urgency
  let urgency: 'high' | 'medium' | 'low' = 'medium';
  if (lower.includes('urgent') || lower.includes('asap') || lower.includes('immediate') || lower.includes('срочно')) {
    urgency = 'high';
  } else if (lower.includes('side project') || lower.includes('hobby') || lower.includes('spare time')) {
    urgency = 'low';
  }

  // 7. Summaries
  let offerSummary = '';
  let wantSummary = '';

  if (role === 'specialist') {
    // Specialist offers expertise, wants clients/projects
    const techStack = extractTechStackKeywords(fullText);
    offerSummary = `Экспертиза в разработке и архитектуре (${techStack || 'Backend / AI / MCP'}): ${item.title}`;
    wantSummary = `Оплачиваемый контракт, интересные задачи внедрения AI/MCP или продуктовая команда`;
  } else if (role === 'founder') {
    // Founder offers equity/budget and vision, wants technical partner
    const termsRef = hasEquity ? 'долевое участие' : (compensationType === 'fixed_budget' ? 'бюджет' : 'проект');
    offerSummary = `Продуктовое видение, кодовая база и ${termsRef} в проекте «${item.title}»`;
    wantSummary = `Технический специалист / партнер (разработка MCP-инструментов, AI-агентов, инфраструктуры)`;
  } else {
    // Open source project looking for contributors
    offerSummary = `Open-source кодовая база, инфраструктура и признание в проекте «${item.title}»`;
    wantSummary = `Разработчики для создания интеграций и расширения функционала (${item.tags?.join(', ') || 'MCP / AI'})`;
  }

  const offerVectorText = `${offerSummary}. Роль: ${role}. Технологии: ${item.tags?.join(', ') || ''}. Условия: ${budgetOrTerms}`.trim();
  const wantVectorText = `${wantSummary}. Категория: ${category}. Ожидания: ${budgetOrTerms}`.trim();

  return {
    isValidDealCandidate: true,
    role,
    compensationType,
    offer: {
      summary: offerSummary,
      category,
      vector_text: offerVectorText,
    },
    want: {
      summary: wantSummary,
      category,
      urgency,
      vector_text: wantVectorText,
    },
    negotiation_constraints: {
      budget_or_terms: budgetOrTerms,
      compensation_type: compensationType,
      role,
      deal_breakers: dealBreakers,
    },
  };
}

function extractTechStackKeywords(text: string): string {
  const keywords = [
    'Python', 'TypeScript', 'JavaScript', 'Go', 'Golang', 'Rust', 'MCP',
    'AI Agents', 'LLM', 'React', 'Node.js', 'FastAPI', 'Docker', 'PostgreSQL', 'SQLite',
  ];
  const matched = keywords.filter((k) => new RegExp(`\\b${k}\\b`, 'i').test(text));
  return matched.slice(0, 5).join(', ');
}

/**
 * Extracts participant Offer/Want using LLM if available, falling back to NLP heuristics.
 * Returns null if the item is classified as not a valid deal candidate.
 */
export async function extractParticipantProfile(item: RawScoutItem): Promise<ScoutProfileRecord | null> {
  let extracted: ExtractedParticipant;

  const llm = resolveLlmClient();
  const model = configuredModel();

  if (llm.client && model) {
    try {
      const prompt = `You are an AI negotiation scout. Analyze this open developer request from ${item.platform} and classify whether it is a genuine candidate for collaboration, partnerships, hiring, or co-founding.
Discard ordinary technical bug reports, defect fixes, crash logs, dependency bumps, or simple user questions.

Post Title: ${item.title}
Author: ${item.authorHandle}
Tags: ${(item.tags || []).join(', ')}
Post Content:
${item.body.slice(0, 2500)}

Respond strictly in valid JSON format:
{
  "is_valid_deal_candidate": true or false,
  "reject_reason": "Explanation if false",
  "role": "specialist | founder | contributor_project",
  "compensation_type": "paid_hourly | fixed_budget | equity_revshare | unpaid_opensource | negotiable",
  "offer": {
    "summary": "1-2 sentence description of what the author/project offers based strictly on the text",
    "category": "services | business | jobs | communities | other",
    "vector_text": "Semantic text representation of what is offered"
  },
  "want": {
    "summary": "1-2 sentence description of what the author is looking for based strictly on the text",
    "category": "services | business | jobs | communities | other",
    "urgency": "high | medium | low",
    "vector_text": "Semantic text representation of what is wanted"
  },
  "negotiation_constraints": {
    "budget_or_terms": "Proposed terms strictly from facts (e.g. '$80/hr', '15% equity', 'Unpaid open-source', 'Bounty $500')",
    "deal_breakers": ["Constraint 1", "Constraint 2"]
  }
}`;

      const response = await llm.client.models.generateContent({
        model,
        contents: prompt,
      });

      const text = response.text?.trim() || '';
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.is_valid_deal_candidate === false) {
        logger.info(`[Extractor LLM] Discarded non-deal candidate "${item.title.slice(0, 50)}": ${parsed.reject_reason || 'Not a valid deal'}`);
        return null;
      }

      if (parsed.offer?.summary && parsed.want?.summary) {
        extracted = {
          isValidDealCandidate: true,
          role: (['specialist', 'founder', 'contributor_project'].includes(parsed.role) ? parsed.role : 'contributor_project') as ParticipantRole,
          compensationType: (['paid_hourly', 'fixed_budget', 'equity_revshare', 'unpaid_opensource', 'negotiable'].includes(parsed.compensation_type)
            ? parsed.compensation_type
            : 'negotiable') as CompensationType,
          offer: {
            summary: String(parsed.offer.summary),
            category: String(parsed.offer.category || 'business'),
            vector_text: String(parsed.offer.vector_text || parsed.offer.summary),
          },
          want: {
            summary: String(parsed.want.summary),
            category: String(parsed.want.category || 'business'),
            urgency: (['high', 'medium', 'low'].includes(parsed.want.urgency) ? parsed.want.urgency : 'medium') as any,
            vector_text: String(parsed.want.vector_text || parsed.want.summary),
          },
          negotiation_constraints: {
            budget_or_terms: String(parsed.negotiation_constraints?.budget_or_terms || 'По договорённости'),
            compensation_type: (parsed.compensation_type || 'negotiable') as CompensationType,
            role: (parsed.role || 'contributor_project') as ParticipantRole,
            deal_breakers: Array.isArray(parsed.negotiation_constraints?.deal_breakers)
              ? parsed.negotiation_constraints.deal_breakers.map(String)
              : ['Чёткие майлстоуны и открытая коммуникация'],
          },
        };
      } else {
        extracted = extractHeuristicProfile(item);
      }
    } catch (err: any) {
      logger.warn(`LLM extraction failed for ${item.sourceUrl}, falling back to heuristic: ${err.message}`);
      extracted = extractHeuristicProfile(item);
    }
  } else {
    extracted = extractHeuristicProfile(item);
  }

  if (!extracted.isValidDealCandidate) {
    logger.info(`[Extractor Heuristic] Discarded non-deal candidate "${item.title.slice(0, 50)}": ${extracted.rejectReason}`);
    return null;
  }

  // Compute vector embeddings separately for Offer and Want
  let offerEmbedding: number[] | undefined;
  let wantEmbedding: number[] | undefined;

  try {
    const offerVec = await computeEmbedding(extracted.offer.vector_text);
    if (offerVec && offerVec.length > 0) offerEmbedding = offerVec;

    const wantVec = await computeEmbedding(extracted.want.vector_text);
    if (wantVec && wantVec.length > 0) wantEmbedding = wantVec;
  } catch (err: any) {
    logger.warn(`Vector embedding computation skipped: ${err.message}`);
  }

  const record: ScoutProfileRecord = {
    id: `profile_${item.id}`,
    sourceUrl: item.sourceUrl,
    platform: item.platform,
    authorHandle: item.authorHandle,
    title: item.title,
    offer: extracted.offer,
    want: extracted.want,
    negotiationConstraints: extracted.negotiation_constraints,
    offerEmbedding,
    wantEmbedding,
    rawContent: item.body,
    matched: false,
    createdAt: item.createdAt,
    updatedAt: Date.now(),
  };

  saveScoutProfileInDb(record);
  return record;
}
