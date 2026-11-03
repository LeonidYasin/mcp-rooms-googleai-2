import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import {
  initDatabase,
  getSystemConfig,
  setSystemConfig,
  deleteSystemConfig,
} from '../server/db';
import {
  getEmbeddingProviderStatus,
  resetEmbeddingClient,
  setCustomGeminiApiKey,
} from '../server/embeddings';
import { authJson, issueTestKey } from './auth-helpers';

describe('Connection & AI Settings Hub API endpoints', () => {
  let server: Server;
  let baseUrl: string;
  let testKey: string;
  const run = Date.now().toString(36);

  const originalEnv = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
  };

  beforeAll(async () => {
    process.env.EMBEDDING_PROVIDER = 'google';
    initDatabase();
    testKey = issueTestKey(`user:hub-tester-${run}`).key;
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (addr && typeof addr === 'object') baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    if (originalEnv.GEMINI_API_KEY !== undefined) {
      process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    if (originalEnv.EMBEDDING_PROVIDER !== undefined) {
      process.env.EMBEDDING_PROVIDER = originalEnv.EMBEDDING_PROVIDER;
    } else {
      delete process.env.EMBEDDING_PROVIDER;
    }
    deleteSystemConfig('gemini_api_key');
    resetEmbeddingClient();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(() => {
    process.env.EMBEDDING_PROVIDER = 'google';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/auth/me', () => {
    it('returns unauthenticated when no Authorization header is passed', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(false);
      expect(data.principal).toBeNull();
    });

    it('returns authenticated with principal details when Bearer token is provided', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: authJson(testKey),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(true);
      expect(data.principal.principalId).toBe(`user:hub-tester-${run}`);
      expect(data.principal.isGuest).toBe(false);
    });

    it('identifies 1-click guest sessions correctly', async () => {
      const guestRes = await fetch(`${baseUrl}/api/auth/guest`, { method: 'POST' });
      expect(guestRes.status).toBe(201);
      const guestData = await guestRes.json();
      expect(guestData.key).toBeDefined();

      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: authJson(guestData.key),
      });
      expect(meRes.status).toBe(200);
      const meData = await meRes.json();
      expect(meData.authenticated).toBe(true);
      expect(meData.principal.principalId.startsWith('user:guest-')).toBe(true);
      expect(meData.principal.isGuest).toBe(true);
    });
  });

  describe('POST /api/embedding/configure', () => {
    it('rejects short, invalid, or placeholder keys with 400', async () => {
      const res = await fetch(`${baseUrl}/api/embedding/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'too-short' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('invalid_key');
    });

    it('clears custom key and reverts to autonomous fallback when apiKey is empty', async () => {
      setCustomGeminiApiKey('dummy-test-key-long-enough-123456');
      expect(getEmbeddingProviderStatus().hasCustomKey).toBe(true);

      const res = await fetch(`${baseUrl}/api/embedding/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: '' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.cleared).toBe(true);
      expect(data.status.provider).toBe('fallback');
      expect(data.status.hasCustomKey).toBe(false);
      expect(getSystemConfig('gemini_api_key')).toBeNull();
    });
  });

  describe('POST /api/embedding/reindex', () => {
    it('successfully triggers catalog reindexing and returns total counts', async () => {
      const res = await fetch(`${baseUrl}/api/embedding/reindex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(typeof data.total).toBe('number');
      expect(typeof data.indexed).toBe('number');
      expect(typeof data.skipped).toBe('number');
    });
  });

  describe('Persistent system_config in SQLite', () => {
    it('stores, updates, and deletes system configuration keys', () => {
      const testConfKey = `test_setting_${run}`;
      expect(getSystemConfig(testConfKey)).toBeNull();

      setSystemConfig(testConfKey, 'initial_val');
      expect(getSystemConfig(testConfKey)).toBe('initial_val');

      setSystemConfig(testConfKey, 'updated_val');
      expect(getSystemConfig(testConfKey)).toBe('updated_val');

      deleteSystemConfig(testConfKey);
      expect(getSystemConfig(testConfKey)).toBeNull();
    });

    it('restores stored gemini_api_key into process.env on initDatabase', () => {
      const dummyKey = `AIzaSyTestKeyStored_${run}`;
      setSystemConfig('gemini_api_key', dummyKey);

      delete process.env.GEMINI_API_KEY;
      initDatabase();

      expect(process.env.GEMINI_API_KEY).toBe(dummyKey);

      deleteSystemConfig('gemini_api_key');
      delete process.env.GEMINI_API_KEY;
    });
  });
});
