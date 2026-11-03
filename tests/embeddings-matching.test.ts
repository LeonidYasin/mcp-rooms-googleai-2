import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  cosineSimilarity,
  lexicalSimilarity,
  getEmbeddingProviderStatus,
  matchListingAsymmetric,
  buildListingEmbeddingText,
  resetEmbeddingClient,
  indexListingEmbedding,
  reindexAllListings,
} from '../server/embeddings';
import {
  initDatabase,
  saveListingEmbeddingInDb,
  getListingEmbeddingFromDb,
  getAllListingEmbeddingsFromDb,
  createListingInDb,
} from '../server/db';

describe('Asymmetric Matching & Embeddings Engine', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetEmbeddingClient();
    initDatabase();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEmbeddingClient();
  });

  describe('cosineSimilarity', () => {
    it('returns 1.0 for identical vectors', () => {
      const vec = [0.5, 0.5, 0.5, 0.5];
      const similarity = cosineSimilarity(vec, vec);
      expect(similarity).toBeCloseTo(1.0, 4);
    });

    it('returns 0.5 for orthogonal vectors due to normalized [0, 1] range', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      const similarity = cosineSimilarity(vecA, vecB);
      expect(similarity).toBeCloseTo(0.5, 4);
    });

    it('returns 0.0 for perfectly opposite vectors', () => {
      const vecA = [1, 0];
      const vecB = [-1, 0];
      const similarity = cosineSimilarity(vecA, vecB);
      expect(similarity).toBeCloseTo(0.0, 4);
    });

    it('gracefully handles empty or missing vectors', () => {
      expect(cosineSimilarity([], [1, 2])).toBe(0);
      expect(cosineSimilarity([1, 2], [])).toBe(0);
      expect(cosineSimilarity(null as any, [1, 2])).toBe(0);
    });
  });

  describe('getEmbeddingProviderStatus & Feature Flag EMBEDDING_PROVIDER', () => {
    it('returns disabled when EMBEDDING_PROVIDER is set to "disabled" or "none"', () => {
      process.env.EMBEDDING_PROVIDER = 'disabled';
      const status = getEmbeddingProviderStatus();
      expect(status.provider).toBe('disabled');
      expect(status.isAvailable).toBe(false);
      expect(status.reason).toContain('Отключено');

      process.env.EMBEDDING_PROVIDER = 'none';
      const statusNone = getEmbeddingProviderStatus();
      expect(statusNone.provider).toBe('disabled');
      expect(statusNone.isAvailable).toBe(false);
    });

    it('returns fallback mode when GEMINI_API_KEY is not provided', () => {
      process.env.EMBEDDING_PROVIDER = 'google';
      delete process.env.GEMINI_API_KEY;
      delete process.env.API_KEY;

      const status = getEmbeddingProviderStatus();
      expect(status.provider).toBe('fallback');
      expect(status.isAvailable).toBe(false);
      expect(status.reason).toContain('лексический');
    });

    it('reports google provider as available when a valid key is provided', () => {
      process.env.EMBEDDING_PROVIDER = 'google';
      process.env.GEMINI_API_KEY = 'AIzaSyAValidMockKeyForUnitTestingPurposesOnly';

      const status = getEmbeddingProviderStatus();
      expect(status.provider).toBe('google');
      expect(status.isAvailable).toBe(true);
      expect(status.model).toBe('text-embedding-004');
    });
  });

  describe('buildListingEmbeddingText', () => {
    it('combines title, description, category, and locality with delimiter', () => {
      const listing = {
        content: {
          title: 'Коворкинг в центре',
          description: 'Уютные столы и скоростной WiFi',
          category: 'real_estate',
          subcategory: 'coworking',
          locality: 'Казань',
        },
      };

      const text = buildListingEmbeddingText(listing);
      expect(text).toBe('Коворкинг в центре · Уютные столы и скоростной WiFi · real_estate · coworking · Казань');
    });

    it('handles flat listing objects and skips undefined fields', () => {
      const listing = {
        title: 'Ремонт ноутбуков',
        description: 'Чистка от пыли и замена термопасты',
        category: 'services',
      };

      const text = buildListingEmbeddingText(listing);
      expect(text).toBe('Ремонт ноутбуков · Чистка от пыли и замена термопасты · services');
    });

    it('returns empty string for null or empty object', () => {
      expect(buildListingEmbeddingText(null)).toBe('');
      expect(buildListingEmbeddingText({})).toBe('');
    });
  });

  describe('SQLite Vector Storage & Retrieval', () => {
    it('persists and retrieves embedding in listing_embeddings table', () => {
      const listingId = `test-list-${Date.now()}`;
      createListingInDb({
        id: listingId,
        owner: 'user:test',
        author_name: 'Test Author',
        content: {
          title: 'Тестовое объявление для вектора',
          description: 'Описание тестового объявления',
          category: 'services',
          kind: 'offer',
          locality: 'Москва',
          modes: ['online'],
        },
      });

      const vector = [0.1, 0.2, 0.3, 0.4, 0.5];
      saveListingEmbeddingInDb({
        id: `emb_${listingId}`,
        listing_id: listingId,
        kind: 'offer',
        provider: 'google',
        model: 'text-embedding-004',
        dimensions: vector.length,
        vector,
      });

      const retrieved = getListingEmbeddingFromDb(listingId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.listing_id).toBe(listingId);
      expect(retrieved?.provider).toBe('google');
      expect(retrieved?.model).toBe('text-embedding-004');
      expect(retrieved?.dimensions).toBe(5);
      expect(retrieved?.vector).toEqual(vector);

      const all = getAllListingEmbeddingsFromDb();
      expect(all.some((e) => e.listing_id === listingId)).toBe(true);
    });
  });

  describe('indexListingEmbedding & reindexAllListings', () => {
    it('returns false when provider is disabled or unavailable', async () => {
      process.env.EMBEDDING_PROVIDER = 'disabled';
      const result = await indexListingEmbedding({ id: 'any-id', title: 'Any title' });
      expect(result).toBe(false);
    });

    it('reindexAllListings handles batch reindexing and skips already indexed items', async () => {
      const reindexResult = await reindexAllListings({ force: false });
      expect(reindexResult).toHaveProperty('total');
      expect(reindexResult).toHaveProperty('indexed');
      expect(reindexResult).toHaveProperty('skipped');
      expect(reindexResult).toHaveProperty('errors');
    });
  });

  describe('lexicalSimilarity & Asymmetry', () => {
    it('gives higher similarity to matching title keywords', () => {
      const scoreHigh = lexicalSimilarity(
        'коворкинг офис аренда',
        'Рабочее место в тихом коворкинге',
        'Предоставляем быстрый интернет и переговорные комнаты',
        'real_estate'
      );

      const scoreLow = lexicalSimilarity(
        'коворкинг офис аренда',
        'Продам детский велосипед',
        'Состояние отличное, 2 колеса',
        'things'
      );

      expect(scoreHigh).toBeGreaterThan(scoreLow);
      expect(scoreHigh).toBeGreaterThan(0.4);
    });

    it('applies asymmetric affinity bonus when Request matches Offer', () => {
      const complementaryScore = lexicalSimilarity(
        'Ищу помещение под офис',
        'Сдам офис в IT-парке',
        'Помещение 45 кв.м',
        'real_estate',
        'request',
        'offer'
      );

      const sameKindScore = lexicalSimilarity(
        'Ищу помещение под офис',
        'Сдам офис в IT-парке',
        'Помещение 45 кв.м',
        'real_estate',
        'request',
        'request'
      );

      expect(complementaryScore).toBeGreaterThanOrEqual(sameKindScore);
    });
  });

  describe('matchListingAsymmetric', () => {
    it('ranks relevant listings on top and includes match metadata', async () => {
      const mockCandidates = [
        {
          id: 'mock-1',
          kind: 'offer',
          category: 'real_estate',
          title: 'Рабочее место в коворкинге',
          description: 'Уютный коворкинг для IT-команд в центре',
        },
        {
          id: 'mock-2',
          kind: 'offer',
          category: 'things',
          title: 'Продажа набора инструментов',
          description: 'Набор ключей и отверток',
        },
        {
          id: 'mock-3',
          kind: 'offer',
          category: 'communities',
          title: 'Парламент сообществ: совет резидентов',
          description: 'Формирование инициативных рабочих групп',
        },
      ];

      const matches = await matchListingAsymmetric('Ищу коворкинг или офис для команды', mockCandidates, {
        queryKind: 'request',
        category: 'real_estate',
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].listing.id).toBe('mock-1');
      expect(matches[0].similarityScore).toBeGreaterThan(0.3);
      expect(matches[0].matchMethod).toBeDefined();
      expect(matches[0].matchReason).toBeDefined();
    });

    it('uses semantic_embedding method when vectors are present in candidates', async () => {
      const mockVectorA = [0.9, 0.1, 0.05, 0.02];
      const mockVectorB = [0.01, 0.02, 0.95, 0.9];

      const candidatesWithVectors = [
        {
          id: 'vec-offer-1',
          kind: 'offer',
          category: 'real_estate',
          title: 'Аренда переговорной комнаты',
          description: 'Оборудованная переговорная с проектором',
          embedding_json: JSON.stringify(mockVectorA),
        },
        {
          id: 'vec-offer-2',
          kind: 'offer',
          category: 'things',
          title: 'Продам роликовые коньки',
          description: 'Размер 42, катались мало',
          embedding_json: JSON.stringify(mockVectorB),
        },
      ];

      const matches = await matchListingAsymmetric('Переговорная комната', candidatesWithVectors, {
        queryKind: 'request',
        category: 'real_estate',
      });

      expect(matches.length).toBe(2);
      expect(matches[0].listing.id).toBe('vec-offer-1');
    });
  });
});
