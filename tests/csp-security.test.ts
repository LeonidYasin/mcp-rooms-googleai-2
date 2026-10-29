import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { securityHeaders } from '../server/http-guard';

describe('CSP & Security Headers (Issue #33)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(securityHeaders);
    app.get('/test-security', (_req, res) => {
      res.json({ ok: true });
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('sets all mandatory security headers on HTTP responses', async () => {
    const res = await fetch(`${baseUrl}/test-security`);

    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('permissions-policy')).toBe('camera=(), geolocation=(), microphone=()');
    expect(res.headers.get('cross-origin-resource-policy')).toBe('same-origin');
  });

  it('sets a strict Content-Security-Policy header containing required directives', async () => {
    const res = await fetch(`${baseUrl}/test-security`);

    const csp = res.headers.get('content-security-policy');
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("img-src 'self' data: blob: /uploads/");
  });
});
