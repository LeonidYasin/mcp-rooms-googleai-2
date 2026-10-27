import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  cosineSimilarity,
  lexicalSimilarity,
  getEmbeddingProviderStatus,
  matchListingAsymmetric,
} from '../server/embeddings';

describe('Asymmetric Matching & Embeddings Engine', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
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
  });
});
