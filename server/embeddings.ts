import { GoogleGenAI } from '@google/genai';

export interface EmbeddingProviderStatus {
  provider: 'google' | 'disabled' | 'fallback';
  model: string;
  isAvailable: boolean;
  reason?: string;
}

export interface MatchResultItem {
  listing: any;
  similarityScore: number; // 0.0 to 1.0
  matchMethod: 'semantic_embedding' | 'lexical_fallback';
  matchReason: string;
}

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('YOUR_')) {
    return null;
  }
  if (!aiClient) {
    try {
      aiClient = new GoogleGenAI();
    } catch {
      aiClient = null;
    }
  }
  return aiClient;
}

export function getEmbeddingProviderStatus(): EmbeddingProviderStatus {
  const rawProvider = (process.env.EMBEDDING_PROVIDER || 'google').toLowerCase().trim();
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-004';
  const apiKey = process.env.GEMINI_API_KEY;

  if (rawProvider === 'disabled' || rawProvider === 'none' || rawProvider === 'false' || rawProvider === 'off') {
    return {
      provider: 'disabled',
      model,
      isAvailable: false,
      reason: 'Отключено через конфигурацию EMBEDDING_PROVIDER=disabled',
    };
  }

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('YOUR_')) {
    return {
      provider: 'fallback',
      model,
      isAvailable: false,
      reason: 'API-ключ Gemini не задан, активен лексический семантический поиск',
    };
  }

  return {
    provider: 'google',
    model,
    isAvailable: true,
    reason: 'Google Embeddings API активен (text-embedding-004)',
  };
}

/**
 * Safe embedding generation with automatic graceful fallback.
 * Never throws exceptions - returns null if unavailable.
 */
export async function computeEmbedding(text: string): Promise<number[] | null> {
  const status = getEmbeddingProviderStatus();
  if (!status.isAvailable) {
    return null;
  }

  const client = getAiClient();
  if (!client) {
    return null;
  }

  try {
    const cleanText = text.trim().slice(0, 2048);
    const response: any = await client.models.embedContent({
      model: status.model,
      contents: cleanText,
    });

    const values = response?.embeddings?.[0]?.values ?? response?.embedding?.values;
    if (Array.isArray(values)) {
      return values;
    }
    return null;
  } catch (err: any) {
    // Graceful fallback without crashing
    return null;
  }
}

/**
 * Standard Cosine Similarity between two float vectors.
 * Returns value between -1.0 and 1.0 (clamped to 0.0 .. 1.0 for similarity).
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const len = Math.min(vecA.length, vecB.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, (sim + 1) / 2)); // normalized to 0.0 - 1.0
}

/**
 * Tokenize Russian/English text into stemmed keyword tokens for fallback matching.
 */
function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => {
      // Basic Russian stemmer heuristics (remove common suffixes)
      return w
        .replace(/(ую|ею|ому|ему|ыми|ими|ого|его|ых|их|ая|яя|ое|ее|ые|ие|ов|ев|ам|ям|ах|ях)$/, '')
        .replace(/(ик|ек|ок|чик|щик|ник)$/, '')
        .replace(/(ть|ти|ет|ит|ут|ют|ат|ят|л|ла|ли|ло)$/, '');
    });
}

/**
 * Robust lexical similarity fallback with TF-IDF style weighting and category affinity.
 */
export function lexicalSimilarity(
  query: string,
  docTitle: string,
  docDescription: string,
  docCategory: string,
  queryKind?: 'request' | 'offer',
  docKind?: 'request' | 'offer'
): number {
  const queryTokens = tokenizeText(query);
  if (queryTokens.length === 0) return 0.2;

  const titleTokens = new Set(tokenizeText(docTitle));
  const descTokens = new Set(tokenizeText(docDescription));
  const catTokens = new Set(tokenizeText(docCategory));

  let score = 0;
  let matches = 0;

  for (const token of queryTokens) {
    if (titleTokens.has(token)) {
      score += 0.45; // Title match has high weight
      matches++;
    } else if (descTokens.has(token)) {
      score += 0.25; // Description match
      matches++;
    } else if (catTokens.has(token)) {
      score += 0.2;
      matches++;
    }
  }

  const tokenCoverage = matches / queryTokens.length;
  let normalizedScore = Math.min(0.95, score * 0.7 + tokenCoverage * 0.3);

  // Asymmetric matching affinity bonus:
  // If user is searching with "request" (Хочу), they seek "offer" (Предлагаю)
  if (queryKind && docKind) {
    if ((queryKind === 'request' && docKind === 'offer') || (queryKind === 'offer' && docKind === 'request')) {
      normalizedScore = Math.min(0.98, normalizedScore + 0.1);
    }
  }

  return Math.max(0.1, Number(normalizedScore.toFixed(3)));
}

/**
 * Asymmetric semantic matching engine:
 * Matches "Хочу" (Request) with "Предлагаю" (Offer) or vice-versa.
 * Uses Google Embeddings when available, or gracefully falls back to lexical index.
 */
export async function matchListingAsymmetric(
  query: string,
  candidateListings: any[],
  options?: {
    queryKind?: 'request' | 'offer';
    category?: string;
    locality?: string;
    limit?: number;
  }
): Promise<MatchResultItem[]> {
  const limit = options?.limit || 10;
  const queryKind = options?.queryKind;
  const status = getEmbeddingProviderStatus();

  // Try Google Embedding first
  let queryEmbedding: number[] | null = null;
  if (status.isAvailable) {
    queryEmbedding = await computeEmbedding(query);
  }

  const results: MatchResultItem[] = [];

  for (const item of candidateListings) {
    const itemKind = (item.kind || item.content?.kind) as 'request' | 'offer';
    const itemCategory = item.category || item.content?.category || '';
    const itemTitle = item.title || item.content?.title || '';
    const itemDesc = item.description || item.content?.description || '';

    // Asymmetric bonus: opposite kind is preferred
    const isAsymmetricComplement =
      queryKind && itemKind && (
        (queryKind === 'request' && itemKind === 'offer') ||
        (queryKind === 'offer' && itemKind === 'request')
      );

    let score = 0;
    let method: 'semantic_embedding' | 'lexical_fallback' = 'lexical_fallback';
    let reason = '';

    // Check if we have vector embeddings for both
    const itemEmbeddingJson = item.embedding_json || item.embeddingVector;
    let itemEmbedding: number[] | null = null;
    if (itemEmbeddingJson) {
      try {
        itemEmbedding = typeof itemEmbeddingJson === 'string' ? JSON.parse(itemEmbeddingJson) : itemEmbeddingJson;
      } catch {
        itemEmbedding = null;
      }
    }

    if (queryEmbedding && itemEmbedding && queryEmbedding.length === itemEmbedding.length) {
      // Calculate true cosine similarity
      const rawCosine = cosineSimilarity(queryEmbedding, itemEmbedding);
      // If asymmetric counterpart, apply intent bonus
      score = isAsymmetricComplement ? Math.min(0.99, rawCosine * 1.05) : rawCosine;
      method = 'semantic_embedding';
      reason = isAsymmetricComplement
        ? `Семантическое сопоставление (Google Embeddings): сопоставлен запрос «Хочу» с предложением «Предлагаю» (${Math.round(score * 100)}%)`
        : `Семантическое сходство векторов Google Embeddings: ${Math.round(score * 100)}%`;
    } else {
      // Graceful fallback to lexical token similarity
      score = lexicalSimilarity(query, itemTitle, itemDesc, itemCategory, queryKind, itemKind);
      method = 'lexical_fallback';
      reason = isAsymmetricComplement
        ? `Асимметричный лексический матчинг: «${queryKind === 'request' ? 'Хочу' : 'Предлагаю'}» → «${itemKind === 'offer' ? 'Предлагаю' : 'Хочу'}» (${Math.round(score * 100)}%)`
        : `Текстовый семантический индекс (fallback): совпадение ключевых параметров (${Math.round(score * 100)}%)`;
    }

    results.push({
      listing: item,
      similarityScore: score,
      matchMethod: method,
      matchReason: reason,
    });
  }

  // Sort descending by similarity score
  results.sort((a, b) => b.similarityScore - a.similarityScore);

  return results.slice(0, limit);
}
