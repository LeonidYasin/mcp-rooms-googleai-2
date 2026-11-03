import { Router } from 'express';
import {
  getEmbeddingProviderStatus,
  testGeminiApiKey,
  setCustomGeminiApiKey,
  reindexAllListings,
  matchListingAsymmetric,
} from '../embeddings';
import { getListingsFromDb } from '../db';
import { rateLimit } from '../http-guard';

export const embeddingsRouter = Router();

embeddingsRouter.get('/api/embedding/status', (_req, res) => {
  try {
    const status = getEmbeddingProviderStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

embeddingsRouter.post('/api/embedding/configure', async (req, res) => {
  try {
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';

    if (!apiKey) {
      // Clear custom key and revert to autonomous fallback
      setCustomGeminiApiKey(null);
      const status = getEmbeddingProviderStatus();
      res.json({
        success: true,
        cleared: true,
        message: 'Google Gemini API ключ сброшен. Активирован автономный локальный режим поиска.',
        status,
      });
      return;
    }

    // Live probe key against Google GenAI embedding model
    const testResult = await testGeminiApiKey(apiKey);
    if (!testResult.valid) {
      res.status(400).json({
        error: 'invalid_key',
        message: testResult.error || 'Недействительный ключ Google Gemini API',
      });
      return;
    }

    setCustomGeminiApiKey(apiKey);
    const status = getEmbeddingProviderStatus();
    res.json({
      success: true,
      message: 'Google Gemini API ключ успешно проверен и сохранён!',
      status,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

embeddingsRouter.post('/api/embedding/reindex', async (req, res) => {
  try {
    const force = Boolean(req.body?.force);
    const result = await reindexAllListings({ force });
    res.json({
      success: true,
      ...result,
      status: getEmbeddingProviderStatus(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

embeddingsRouter.post('/api/match', rateLimit('match', 'RATE_LIMIT_MATCH_PER_MINUTE', 60), async (req, res) => {
  try {
    const { query, query_kind, category, locality, limit } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Параметр query обязателен' });
      return;
    }
    const candidates = getListingsFromDb({ category, locality });
    const matches = await matchListingAsymmetric(query, candidates, {
      queryKind: query_kind,
      category,
      locality,
      limit: limit || 10,
    });
    res.json({
      query,
      query_kind: query_kind || 'request',
      embedding_status: getEmbeddingProviderStatus(),
      matches,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
