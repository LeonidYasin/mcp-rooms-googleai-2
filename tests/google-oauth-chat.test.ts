import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { initDatabase } from '../server/db';
import { issueTestKey, authJson } from './auth-helpers';

describe('Google OAuth 2.0 Gemini Chat Integration', () => {
  let server: Server;
  let baseUrl: string;
  let apiKey: string;

  beforeAll(async () => {
    initDatabase();
    apiKey = issueTestKey('user:google-oauth-test').key;
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
  });

  it('includes https://accounts.google.com in CSP headers for Google Identity Services', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const csp = res.headers.get('content-security-policy') || '';
    expect(csp).toContain('https://accounts.google.com');
  });

  it('handles expired/invalid Google OAuth token gracefully without server error', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        ...authJson(apiKey),
        'x-google-access-token': 'ya29.invalid-mock-token-for-testing',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Привет! Расскажи о возможностях платформы' }],
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.degraded).toBe(true);
    expect(data.text).toBeDefined();
    // Ensures rule-based dynamic fallback answered gracefully
    expect(data.text.length).toBeGreaterThan(10);
  });

  it('accepts googleAccessToken in request body', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: authJson(apiKey),
      body: JSON.stringify({
        googleAccessToken: 'ya29.invalid-body-mock-token',
        messages: [{ role: 'user', content: 'Покажи правила и принципы площадки' }],
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.degraded).toBe(true);
    expect(data.text).toBeDefined();
  });
});
