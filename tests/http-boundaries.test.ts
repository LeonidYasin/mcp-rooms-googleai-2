import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { initDatabase } from '../server/db';
import { resetRateLimits, rateLimit } from '../server/http-guard';
import { authJson, issueTestKey } from './auth-helpers';

/**
 * F-13 contract: the HTTP edge has a bounded body, explicit CORS, security
 * headers, and per-principal limits. Everything here is observable by a client.
 */
describe('HTTP boundaries', () => {
  let server: Server;
  let baseUrl: string;
  let key: string;

  const run = Date.now().toString(36);

  beforeAll(async () => {
    initDatabase();
    resetRateLimits();
    key = issueTestKey(`user:http-${run}`).key;

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    resetRateLimits();
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('sets security headers and hides the framework', async () => {
    const res = await fetch(`${baseUrl}/api/listings`);

    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('rejects JSON bodies above 256kb with 413', async () => {
    const res = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: authJson(key),
      body: JSON.stringify({ title: 'x'.repeat(300 * 1024) }),
    });

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe('payload_too_large');
  });

  it('maps malformed JSON to 400 instead of an HTML error page', async () => {
    const res = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: authJson(key),
      body: '{"title":',
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_json');
  });

  it('refuses a cross-origin preflight from an unlisted origin', async () => {
    const res = await fetch(`${baseUrl}/api/listings`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });

    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect((await res.json()).error).toBe('cors_origin_not_allowed');
  });

  it('refuses a cross-origin write from an unlisted origin', async () => {
    const res = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: { ...authJson(key), Origin: 'https://evil.example' },
      body: JSON.stringify({ title: 'cross-origin' }),
    });

    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('does not treat the app origin as cross-origin', async () => {
    const res = await fetch(`${baseUrl}/api/listings`, {
      headers: { Origin: baseUrl },
    });

    expect(res.status).toBe(200);
  });

  it('wires the limiter into /api/chat', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: authJson(key),
      body: JSON.stringify({ messages: [{ role: 'user', content: 'привет' }] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('x-ratelimit-limit')).toBe('30');
    expect(Number(res.headers.get('x-ratelimit-remaining'))).toBeLessThan(30);
  });

  it('returns 429 with Retry-After once a principal exhausts its budget', () => {
    const envName = 'RATE_LIMIT_UNIT_TEST_PER_MINUTE';
    const previous = process.env[envName];
    process.env[envName] = '2';
    resetRateLimits();

    const headers: Record<string, string> = {};
    const response = () => {
      const res: any = {
        statusCode: 200,
        body: undefined,
        setHeader: (name: string, value: string) => {
          headers[name.toLowerCase()] = value;
        },
        status(code: number) {
          res.statusCode = code;
          return res;
        },
        json(payload: unknown) {
          res.body = payload;
          return res;
        },
      };
      return res;
    };
    const request = (principalId: string) =>
      ({ principal: { principalId }, ip: '127.0.0.1' }) as any;

    try {
      const limiter = rateLimit('unit', envName, 1000);
      let passed = 0;
      for (let i = 0; i < 3; i += 1) {
        limiter(request('user:unit'), response(), () => {
          passed += 1;
        });
      }

      expect(passed).toBe(2);
      const limited: any = response();
      limiter(request('user:unit'), limited, () => {
        passed += 1;
      });
      expect(passed).toBe(2);
      expect(limited.statusCode).toBe(429);
      expect(limited.body.error).toBe('rate_limited');
      expect(headers['retry-after']).toBeTruthy();
      expect(headers['x-ratelimit-remaining']).toBe('0');

      // A different principal has its own budget.
      const other: any = response();
      let otherPassed = 0;
      limiter(request('user:someone-else'), other, () => {
        otherPassed += 1;
      });
      expect(otherPassed).toBe(1);
      expect(other.statusCode).toBe(200);
    } finally {
      if (previous === undefined) delete process.env[envName];
      else process.env[envName] = previous;
      resetRateLimits();
    }
  });
});
