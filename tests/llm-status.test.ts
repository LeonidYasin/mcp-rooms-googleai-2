import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { initDatabase } from '../server/db';
import { LLM_COOLDOWN_MS, llmStatus, recordLlmFailure, resetLlmState } from '../server/llm';
import { authJson, issueTestKey } from './auth-helpers';

/**
 * F-15 contract: the model id comes from configuration, the degraded reason is
 * a stable code, and the circuit breaker is explicit instead of a silent
 * 30-second negative cache.
 *
 * Nothing here calls a model: the key/model pairs are local strings and the
 * cooldown is opened by `recordLlmFailure`, so CI needs no paid key and no
 * network. A real model call is therefore *not* verified by this suite.
 */
describe('LLM status and degraded reasons', () => {
  let server: Server;
  let baseUrl: string;
  let key: string;

  const run = Date.now().toString(36);
  const placedKey = 'vitest-key-0123456789abcdef';
  const placedModel = 'vitest-model-not-a-real-id';

  const originalEnv = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    API_KEY: process.env.API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  };

  const setEnv = (values: { key?: string; model?: string }) => {
    delete process.env.API_KEY;
    process.env.GEMINI_API_KEY = values.key ?? '';
    if (values.model === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = values.model;
  };

  const getStatus = async () => {
    const res = await fetch(`${baseUrl}/api/llm/status`);
    expect(res.status).toBe(200);
    return res.json();
  };

  const chat = async (content: string) => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: authJson(key),
      body: JSON.stringify({ messages: [{ role: 'user', content }] }),
    });
    expect(res.status).toBe(200);
    return res.json();
  };

  beforeAll(async () => {
    initDatabase();
    key = issueTestKey(`user:llm-status-${run}`).key;
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (addr && typeof addr === 'object') baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    resetLlmState();
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    resetLlmState();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetLlmState();
  });

  it('reports missing_api_key and makes no call', async () => {
    setEnv({});

    const status = await getStatus();
    expect(status.configured).toBe(false);
    expect(status.model).toBeNull();
    expect(status.degradedReason).toBe('missing_api_key');
    expect(status.cooldownUntil).toBeNull();
    expect(status.metrics.modelCalls).toBe(0);

    const answer = await chat('qwertyuiop');
    expect(answer.degraded).toBe(true);
    expect(answer.degradedReason).toBe('missing_api_key');
    expect(answer.executedTools).toEqual([]);
    expect(answer.model).toBeUndefined();
  });

  it('treats a key without GEMINI_MODEL as model_not_configured, not a guessed model', async () => {
    setEnv({ key: placedKey });

    const status = await getStatus();
    expect(status.configured).toBe(false);
    expect(status.model).toBeNull();
    expect(status.degradedReason).toBe('model_not_configured');

    const answer = await chat('qwertyuiop');
    expect(answer.degraded).toBe(true);
    expect(answer.degradedReason).toBe('model_not_configured');
    expect(answer.executedTools).toEqual([]);
    // No client was created, so no outbound request could have been attempted.
    expect(llmStatus().metrics.modelCalls).toBe(0);
  });

  it('is configured once both key and model are present, without probing the model', async () => {
    setEnv({ key: placedKey, model: placedModel });

    const status = await getStatus();
    expect(status).toEqual({
      configured: true,
      model: placedModel,
      degradedReason: null,
      cooldownUntil: null,
      metrics: { modelCalls: 0, modelFailures: 0, suppressedCalls: 0 },
    });
  });

  it('opens an explicit invalid_api_key cooldown instead of a silent cache', async () => {
    setEnv({ key: placedKey, model: placedModel });

    const reason = recordLlmFailure(new Error('API_KEY_INVALID: API key not valid'));
    expect(reason).toBe('invalid_api_key');
    expect(console.warn).toHaveBeenCalledTimes(1);

    const status = await getStatus();
    expect(status.configured).toBe(false);
    expect(status.degradedReason).toBe('invalid_api_key');
    expect(status.cooldownUntil).not.toBeNull();
    expect(Date.parse(status.cooldownUntil)).toBeGreaterThan(Date.now());
    expect(status.metrics.modelFailures).toBe(1);

    // During the cooldown the answer is degraded for the stated reason and no
    // tool is reported as executed by the model.
    const answer = await chat('qwertyuiop');
    expect(answer.degraded).toBe(true);
    expect(answer.degradedReason).toBe('invalid_api_key');
    expect(answer.executedTools).toEqual([]);
    expect(llmStatus().metrics.modelCalls).toBe(0);
    expect(llmStatus().metrics.suppressedCalls).toBeGreaterThan(0);
  });

  it('classifies other failures as model_error and expires the cooldown', async () => {
    setEnv({ key: placedKey, model: placedModel });

    expect(recordLlmFailure(new Error('429 RESOURCE_EXHAUSTED'))).toBe('model_error');
    const cooling = llmStatus();
    expect(cooling.degradedReason).toBe('model_error');
    expect(cooling.configured).toBe(false);

    const after = llmStatus(Date.now() + LLM_COOLDOWN_MS + 1);
    expect(after.configured).toBe(true);
    expect(after.degradedReason).toBeNull();
    expect(after.cooldownUntil).toBeNull();
  });

  it('does not inherit a cooldown after the model is reconfigured', async () => {
    setEnv({ key: placedKey, model: placedModel });
    recordLlmFailure(new Error('API_KEY_INVALID: API key not valid'));

    process.env.GEMINI_MODEL = 'another-model';
    const status = llmStatus();
    expect(status.configured).toBe(true);
    expect(status.model).toBe('another-model');
    expect(status.degradedReason).toBeNull();
  });
});
