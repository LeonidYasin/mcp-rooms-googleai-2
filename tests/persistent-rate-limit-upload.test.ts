import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Server } from 'http';
import path from 'path';
import fs from 'fs';
import { app } from '../server';
import { initDatabase, validateImageMagicBytes } from '../server/db';
import { resetRateLimits } from '../server/http-guard';
import { authJson, issueTestKey } from './auth-helpers';

describe('Persistent Rate Limiting & Upload Storage Tests', () => {
  let server: Server;
  let baseUrl: string;
  let userKey: string;

  const run = Date.now().toString(36);
  const userId = `user:rate-upload-${run}`;

  // Valid 1x1 1-byte PNG magic header buffer
  const samplePng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  beforeAll(async () => {
    initDatabase();
    userKey = issueTestKey(userId).key;

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

  beforeEach(() => {
    resetRateLimits();
  });

  it('validates image magic bytes correctly', () => {
    expect(validateImageMagicBytes(samplePng)).toBe('image/png');
    expect(validateImageMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(validateImageMagicBytes(Buffer.from('NOT AN IMAGE'))).toBeNull();
  });

  it('uploads valid PNG image and serves it via /uploads/:filename', async () => {
    const uploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        ...authJson(userKey),
        'Content-Type': 'image/png',
      },
      body: samplePng,
    });

    expect(uploadRes.status).toBe(201);
    const uploaded = await uploadRes.json();
    expect(uploaded.id).toBeDefined();
    expect(uploaded.url).toContain('/uploads/');
    expect(uploaded.mimeType).toBe('image/png');

    // Fetch static image back
    const imageRes = await fetch(`${baseUrl}${uploaded.url}`);
    expect(imageRes.status).toBe(200);
    expect(imageRes.headers.get('content-type')).toBe('image/png');
    const imageBuf = Buffer.from(await imageRes.arrayBuffer());
    expect(imageBuf.length).toBe(samplePng.length);
  });

  it('rejects invalid image uploads with 422', async () => {
    const invalidRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        ...authJson(userKey),
        'Content-Type': 'image/png',
      },
      body: Buffer.from('THIS IS TEXT, NOT AN IMAGE FILE'),
    });

    expect(invalidRes.status).toBe(422);
    const data = await invalidRes.json();
    expect(data.error).toBe('invalid_image_format');
  });

  it('resolves trust proxy IP when TRUST_PROXY=1', async () => {
    const originalTrust = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = '1';

    const res = await fetch(`${baseUrl}/api/listings`, {
      headers: {
        'X-Forwarded-For': '203.0.113.195, 198.51.100.1',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();

    process.env.TRUST_PROXY = originalTrust;
  });
});
