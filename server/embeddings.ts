import { GoogleGenAI } from '@google/genai';
import {
  saveListingEmbeddingInDb,
  getListingsFromDb,
  getSystemConfig,
  setSystemConfig,
  deleteSystemConfig,
} from './db';

export interface EmbeddingProviderStatus {
  provider: 'google' | 'disabled' | 'fallback';
  model: string;
  isAvailable: boolean;
  reason?: string;
  hasCustomKey?: boolean;
  keyMasked?: string;
  isConfiguredViaWeb?: boolean;
}

export interface MatchResultItem {
  listing: any;
  similarityScore: number; // 0.0 to 1.0
  matchMethod: 'semantic_embedding' | 'lexical_fallback';
  matchReason: string;
}

let aiClient: GoogleGenAI | null = null;
let isGeminiEmbeddingKeyValid = true;
let lastInvalidEmbeddingKey: string | null = null;

export function resetEmbeddingClient(): void {
  aiClient = null;
  isGeminiEmbeddingKeyValid = true;
  lastInvalidEmbeddingKey = null;
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  if (!apiKey || apiKey === '' || apiKey.includes('YOUR_') || apiKey.length < 15) {
    return null;
  }
  if (lastInvalidEmbeddingKey === apiKey && !isGeminiEmbeddingKeyValid) {
    return null;
  }
  if (!aiClient) {
    try {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch {
      aiClient = null;
    }
  }
  return aiClient;
}

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '***';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export function getEmbeddingProviderStatus(): EmbeddingProviderStatus {
  const rawProvider = (process.env.EMBEDDING_PROVIDER || 'google').toLowerCase().trim();
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-004';
  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  const hasCustomKey = Boolean(apiKey && apiKey.length >= 15 && !apiKey.includes('YOUR_'));
  const keyMasked = hasCustomKey ? maskApiKey(apiKey) : undefined;
  let isConfiguredViaWeb = false;
  try {
    isConfiguredViaWeb = Boolean(getSystemConfig('gemini_api_key'));
  } catch {
    // ignore
  }

  if (rawProvider === 'disabled' || rawProvider === 'none' || rawProvider === 'false' || rawProvider === 'off') {
    return {
      provider: 'disabled',
      model,
      isAvailable: false,
      reason: 'Отключено через конфигурацию EMBEDDING_PROVIDER=disabled',
      hasCustomKey,
      keyMasked,
      isConfiguredViaWeb,
    };
  }

  if (!apiKey || apiKey === '' || apiKey.includes('YOUR_') || apiKey.length < 15) {
    return {
      provider: 'fallback',
      model,
      isAvailable: false,
      reason: 'API-ключ Gemini не задан, активен лексический семантический поиск',
      hasCustomKey: false,
      isConfiguredViaWeb,
    };
  }

  if (!isGeminiEmbeddingKeyValid && lastInvalidEmbeddingKey === apiKey) {
    return {
      provider: 'fallback',
      model,
      isAvailable: false,
      reason: 'API-ключ недействителен, активен лексический семантический поиск',
      hasCustomKey,
      keyMasked,
      isConfiguredViaWeb,
    };
  }

  return {
    provider: 'google',
    model,
    isAvailable: true,
    reason: 'Google Embeddings API активен (text-embedding-004)',
    hasCustomKey,
    keyMasked,
    isConfiguredViaWeb,
  };
}

export async function testGeminiApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const trimmed = (apiKey || '').trim();
  if (!trimmed || trimmed.length < 15 || trimmed.includes('YOUR_')) {
    return { valid: false, error: 'Ключ слишком короткий или содержит шаблонное значение' };
  }

  try {
    const probeClient = new GoogleGenAI({
      apiKey: trimmed,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response: any = await probeClient.models.embedContent({
      model: process.env.EMBEDDING_MODEL || 'text-embedding-004',
      contents: 'mcp-rooms probe',
    });

    const values = response?.embeddings?.[0]?.values ?? response?.embedding?.values;
    if (Array.isArray(values) && values.length > 0) {
      return { valid: true };
    }
    return { valid: false, error: 'Google AI не вернул вектор эмбеддинга' };
  } catch (err: any) {
    const msg = err?.message || 'Ошибка проверки ключа Google AI';
    return { valid: false, error: msg };
  }
}

export function setCustomGeminiApiKey(apiKey: string | null): void {
  if (!apiKey || !apiKey.trim()) {
    delete process.env.GEMINI_API_KEY;
    deleteSystemConfig('gemini_api_key');
    resetEmbeddingClient();
  } else {
    const trimmed = apiKey.trim();
    process.env.GEMINI_API_KEY = trimmed;
    setSystemConfig('gemini_api_key', trimmed);
    resetEmbeddingClient();
  }
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
    if (err?.message?.includes('API_KEY_INVALID') || err?.message?.includes('API key not valid')) {
      const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
      lastInvalidEmbeddingKey = apiKey;
      isGeminiEmbeddingKeyValid = false;
      aiClient = null;
    }
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
        .replace(/(ть|ти|ет|ит|ут|ют|ат|ят|л|ла|ли|ло)$/, '')
        // Light stemming for Russian case endings: "коворкинге" -> "коворкинг".
        .replace(/[аеёиоуыэюяйь]$/, '');
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

/**
 * Constructs semantic text representation for a listing to compute its vector.
 */
export function buildListingEmbeddingText(listing: any): string {
  if (!listing) return '';
  const content = listing.content || listing;
  const parts = [
    content.title,
    content.description,
    content.category,
    content.subcategory,
    content.locality,
  ].filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
  return parts.join(' · ');
}

/**
 * Computes embedding for a listing and stores it in SQLite if provider is active.
 * Safe and non-blocking: returns boolean indicating whether embedding was computed and stored.
 */
export async function indexListingEmbedding(listing: any): Promise<boolean> {
  if (!listing || !listing.id) return false;
  const status = getEmbeddingProviderStatus();
  if (!status.isAvailable) return false;

  const text = buildListingEmbeddingText(listing);
  if (!text) return false;

  const vector = await computeEmbedding(text);
  if (!vector || vector.length === 0) return false;

  const listingId = String(listing.id);
  const kind = (listing.kind || listing.content?.kind || 'offer') as 'request' | 'offer';

  saveListingEmbeddingInDb({
    id: `emb_${listingId}`,
    listing_id: listingId,
    kind,
    provider: status.provider,
    model: status.model,
    dimensions: vector.length,
    vector,
  });

  return true;
}

/**
 * Batch reindexer for all listings in the SQLite database.
 * Supports rate-limiting pause between calls to respect Google AI Studio quotas.
 */
export async function reindexAllListings(options?: {
  force?: boolean;
  batchDelayMs?: number;
  onProgress?: (processed: number, total: number, listingId: string, status: 'indexed' | 'skipped' | 'error') => void;
}): Promise<{ total: number; indexed: number; skipped: number; errors: number }> {
  const force = options?.force ?? false;
  const delayMs = options?.batchDelayMs ?? 50;

  const allListings = getListingsFromDb({});
  const total = allListings.length;
  let indexed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < total; i++) {
    const item = allListings[i];
    if (!force && item.embedding_json) {
      skipped++;
      options?.onProgress?.(i + 1, total, item.id, 'skipped');
      continue;
    }

    try {
      const ok = await indexListingEmbedding(item);
      if (ok) {
        indexed++;
        options?.onProgress?.(i + 1, total, item.id, 'indexed');
      } else {
        skipped++;
        options?.onProgress?.(i + 1, total, item.id, 'skipped');
      }
    } catch {
      errors++;
      options?.onProgress?.(i + 1, total, item.id, 'error');
    }

    if (delayMs > 0 && i < total - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { total, indexed, skipped, errors };
}
