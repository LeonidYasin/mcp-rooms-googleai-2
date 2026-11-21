import { RawScoutItem } from './scout';
import { ScoutProfileRecord, saveScoutProfileInDb } from './db';
import { computeEmbedding } from './embeddings';
import { logger } from './logger';

export interface ExtractedParticipant {
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
    deal_breakers: string[];
  };
}

/**
 * Intelligent deterministic NLP extractor that parses raw unstructured requests
 * into strict Offer / Want JSON schema.
 */
export function extractHeuristicProfile(item: RawScoutItem): ExtractedParticipant {
  const fullText = `${item.title}\n${item.body}`.trim();
  const lower = fullText.toLowerCase();

  // 1. Detect Category
  let category = 'business';
  if (lower.includes('mcp') || lower.includes('model context protocol') || lower.includes('agent') || lower.includes('sdk')) {
    category = 'services';
  } else if (lower.includes('co-founder') || lower.includes('cofounder') || lower.includes('equity') || lower.includes('startup') || lower.includes('gtm')) {
    category = 'business';
  } else if (lower.includes('hiring') || lower.includes('job') || lower.includes('salary') || lower.includes('seeking work') || lower.includes('freelance')) {
    category = 'jobs';
  } else if (lower.includes('contributor') || lower.includes('open source') || lower.includes('community')) {
    category = 'communities';
  }

  // 2. Classify intent: Seeking Work vs Hiring/Seeking Contributors vs Co-founder
  const isLookingForHelp =
    lower.includes('looking for contributor') ||
    lower.includes('looking for developer') ||
    lower.includes('looking for engineers') ||
    lower.includes('help wanted') ||
    lower.includes('we are looking for') ||
    lower.includes('seeking contributor') ||
    lower.includes('seeking developer');

  const isSeekingWork =
    !isLookingForHelp &&
    (lower.includes('seeking work') ||
      lower.includes('for hire') ||
      lower.includes('available for hire') ||
      lower.includes('portfolio') ||
      lower.includes('who wants to be hired'));

  const isCoFounder =
    lower.includes('co-founder') ||
    lower.includes('cofounder') ||
    lower.includes('looking for co-founder');

  let offerSummary = '';
  let wantSummary = '';
  let urgency: 'high' | 'medium' | 'low' = 'medium';
  let budgetOrTerms = 'По договорённости / Rev-share или фикс';
  const dealBreakers: string[] = [];

  // Extract budget or terms
  if (lower.includes('equity') || lower.includes('доля') || lower.includes('rev-share') || lower.includes('revshare')) {
    budgetOrTerms = 'Equity / Rev-share (долевое участие)';
  } else if (lower.includes('$') || lower.includes('usd') || lower.includes('eur') || lower.includes('руб') || lower.includes('/hr') || lower.includes('/mo')) {
    const moneyMatch = fullText.match(/(\$\s*\d+[\d,]*(\/\w+)?|\d+k?\s*(usd|eur|rub|руб|\$)|(\d+\s*-\s*\d+k?))/i);
    budgetOrTerms = moneyMatch ? `Бюджет / ставка: ${moneyMatch[0]}` : 'Фиксированная оплата / почасовая ставка';
  } else if (lower.includes('open source') || lower.includes('unpaid') || lower.includes('contributor')) {
    budgetOrTerms = 'Open Source / Совместный контрибьютинг';
  }

  // Extract deal-breakers
  if (lower.includes('remote only') || lower.includes('remote') || lower.includes('удален')) {
    dealBreakers.push('Только Remote (удалённый формат сотрудничества)');
  }
  if (lower.includes('no agencies') || lower.includes('no recruiters')) {
    dealBreakers.push('Без агентств и сторонних рекрутеров');
  }
  if (lower.includes('nda') || lower.includes('ip transfer')) {
    dealBreakers.push('Требуется подписание NDA и передача прав');
  }
  if (dealBreakers.length === 0) {
    dealBreakers.push('Чёткие майлстоуны и регулярная синхронизация в коде/архитектуре');
  }

  // Determine Urgency
  if (lower.includes('urgent') || lower.includes('asap') || lower.includes('immediate') || lower.includes('срочно')) {
    urgency = 'high';
  } else if (lower.includes('side project') || lower.includes('hobby') || lower.includes('spare time')) {
    urgency = 'low';
  }

  if (isSeekingWork) {
    // Participant offers skills/services, wants project/income
    offerSummary = `Экспертные навыки разработки, реализация архитектуры и кодовой базы: ${item.title}`;
    wantSummary = `Интересные проекты, задачи внедрения AI/MCP, гибкие условия или контрактная занятость`;
  } else if (isCoFounder) {
    offerSummary = `Продуктовое видение, MVP-код или доменная экспертиза по проекту «${item.title}»`;
    wantSummary = `Технический или GTM ко-фаундер (разработка, AI-агенты, продвижение, выход на рынок)`;
  } else {
    // Project looking for contributors / developers / solutions
    offerSummary = `Open-source кодовая база, инфраструктура, комьюнити или долевое участие в «${item.title}»`;
    wantSummary = `Разработчики и контрибьюторы для реализации интеграций (MCP / AI-агенты, backend, UI)`;
  }

  // Build clean vector texts for semantic embedding
  const offerVectorText = `${offerSummary}. Стек и технологии: ${item.tags?.join(', ') || ''}. Контекст: ${item.title}`.trim();
  const wantVectorText = `${wantSummary}. Требования и цели: ${item.title}. Категория: ${category}`.trim();

  return {
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
      deal_breakers: dealBreakers,
    },
  };
}

/**
 * Extracts participant Offer/Want using LLM if available, falling back to NLP heuristics.
 */
export async function extractParticipantProfile(item: RawScoutItem): Promise<ScoutProfileRecord> {
  let extracted: ExtractedParticipant;

  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  const geminiModel = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();

  if (apiKey && apiKey.length >= 15 && !apiKey.includes('YOUR_')) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'mcp-rooms-extractor' } },
      });

      const prompt = `You are an AI negotiation scout. Analyze this open request from ${item.platform} and extract structured participant profiles into valid JSON only.

Post Title: ${item.title}
Author: ${item.authorHandle}
Tags: ${(item.tags || []).join(', ')}
Post Content:
${item.body.slice(0, 2500)}

Respond strictly with this JSON structure (no markdown, no other text):
{
  "offer": {
    "summary": "1-2 sentence description of what the author/project offers (code, skills, equity, budget, infrastructure, audience)",
    "category": "business | jobs | services | communities | other",
    "vector_text": "Semantic text representation of what is offered"
  },
  "want": {
    "summary": "1-2 sentence description of what the author is looking for (developer, co-founder, GTM partner, integrations, solution)",
    "category": "business | jobs | services | communities | other",
    "urgency": "high | medium | low",
    "vector_text": "Semantic text representation of what is wanted"
  },
  "negotiation_constraints": {
    "budget_or_terms": "Proposed terms, rev-share, budget, equity or hourly",
    "deal_breakers": ["Constraint 1", "Constraint 2"]
  }
}`;

      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: prompt,
      });

      const text = response.text?.trim() || '';
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.offer?.summary && parsed.want?.summary) {
        extracted = {
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
            deal_breakers: Array.isArray(parsed.negotiation_constraints?.deal_breakers)
              ? parsed.negotiation_constraints.deal_breakers.map(String)
              : ['Чёткие майлстоуны'],
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
