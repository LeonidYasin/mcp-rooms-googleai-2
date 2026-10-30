import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { initDatabase } from '../server/db';
import { issueTestKey, authJson } from './auth-helpers';

describe('Multi-Provider AI & OpenRouter Integration', () => {
  let server: Server;
  let baseUrl: string;
  let apiKey: string;

  const originalEnv = {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  };

  beforeAll(async () => {
    initDatabase();
    apiKey = issueTestKey('user:multi-provider-test').key;
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    process.env.OPENROUTER_API_KEY = originalEnv.OPENROUTER_API_KEY;
    process.env.OPENROUTER_MODEL = originalEnv.OPENROUTER_MODEL;
    process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;
    process.env.GEMINI_MODEL = originalEnv.GEMINI_MODEL;
  });

  it('GET /api/llm/status lists all supported external AI providers and recommendations', async () => {
    const res = await fetch(`${baseUrl}/api/llm/status`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.supportedProviders).toEqual(
      expect.arrayContaining(['openrouter', 'gemini', 'deepseek', 'openai', 'custom'])
    );
    expect(data.freeModelRecommendation).toBe('deepseek/deepseek-chat:free');
  });

  it('GET /api/llm/status reflects server-side OPENROUTER_API_KEY when configured', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-mock-test-key';
    process.env.OPENROUTER_MODEL = 'deepseek/deepseek-chat:free';

    const res = await fetch(`${baseUrl}/api/llm/status`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.configured).toBe(true);
    expect(data.hasOpenRouter).toBe(true);
    expect(data.serverProvider).toBe('openrouter');
    expect(data.model).toBe('deepseek/deepseek-chat:free');

    delete process.env.OPENROUTER_API_KEY;
  });

  it('POST /api/chat handles invalid user-provided OpenAI/OpenRouter key gracefully without crashing', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        ...authJson(apiKey),
        'x-llm-provider': 'openrouter',
        'x-llm-api-key': 'sk-or-invalid-test-key-should-fail-gracefully',
        'x-llm-model': 'deepseek/deepseek-chat:free',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Привет! Расскажи о возможностях платформы' }],
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.degraded).toBe(true);
    expect(data.text).toBeDefined();
    expect(data.text.length).toBeGreaterThan(10);
  });

  it('POST /api/chat accepts provider configuration in request body', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: authJson(apiKey),
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Привет! Есть ли у вас программисты?' }],
        llmProvider: 'deepseek',
        llmApiKey: 'sk-mock-deepseek-invalid-key',
        llmModel: 'deepseek-chat',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.degraded).toBe(true);
    expect(data.text).toBeDefined();
  });
});
