import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { initDatabase } from '../server/db';
import { app } from '../server';

describe('Production Healthchecks & Readiness Probes API', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    initDatabase();

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('returns 200 OK for liveness probe /healthz', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });

  it('returns 200 OK for readiness probe /readyz when database is connected', async () => {
    const res = await fetch(`${baseUrl}/readyz`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ready');
    expect(body.database).toBe('connected');
  });
});
