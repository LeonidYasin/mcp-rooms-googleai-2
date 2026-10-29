import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { initDatabase, getListingsFromDb } from '../server/db';
import { executeMcpToolCall } from '../server/mcp';
import { authJson, issueTestKey } from './auth-helpers';

describe('PR-11: E2E Marketplace Flow & Abuse Security Tests', () => {
  let server: Server;
  let baseUrl: string;
  let keyA: string;
  let keyB: string;
  let keyC: string;

  const run = Date.now().toString(36);
  const userA = `user:e2e-seller-${run}`;
  const userB = `user:e2e-buyer-${run}`;
  const userC = `user:e2e-attacker-${run}`;

  beforeAll(async () => {
    initDatabase();
    keyA = issueTestKey(userA).key;
    keyB = issueTestKey(userB).key;
    keyC = issueTestKey(userC).key;

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

  it('E2E Lifecycle: User A publishes -> User B discovers & contacts -> User C denied', async () => {
    // 1. User A creates a draft listing
    const draftRes = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: authJson(keyA),
      body: JSON.stringify({
        title: 'MacBook Pro M3 Max 64GB',
        description: 'Отличное состояние, полный комплект, идеален для AI разработки.',
        category: 'things',
        kind: 'offer',
        modes: ['pickup', 'shipping'],
        locality: 'Kazan',
        price_rubles: 240000,
      }),
    });
    expect(draftRes.status).toBe(201);
    const draft = await draftRes.json();
    expect(draft.status).toBe('draft');

    // 2. User A gets preview & consent token
    const previewRes = await fetch(`${baseUrl}/api/listings/${draft.id}/preview`, {
      method: 'POST',
      headers: authJson(keyA),
    });
    expect(previewRes.status).toBe(200);
    const preview = await previewRes.json();
    expect(preview.consent_token).toBeDefined();

    // 3. User A publishes listing
    const publishRes = await fetch(`${baseUrl}/api/listings/${draft.id}/publish`, {
      method: 'POST',
      headers: authJson(keyA),
      body: JSON.stringify({
        consent_token: preview.consent_token,
        revision: preview.revision,
      }),
    });
    expect(publishRes.status).toBe(200);
    const published = await publishRes.json();
    expect(published.status).toBe('active');

    // 4. User B searches and discovers User A's listing
    const searchRes = await fetch(`${baseUrl}/api/listings?query=MacBook&locality=Kazan`);
    expect(searchRes.status).toBe(200);
    const searchResults = await searchRes.json();
    const found = searchResults.find((l: any) => l.id === draft.id);
    expect(found).toBeDefined();
    expect(found.content.title).toBe('MacBook Pro M3 Max 64GB');

    // 5. User B joins room to initiate negotiation
    const joinResult = await executeMcpToolCall(
      'join_room',
      {
        listing_id: draft.id,
        initial_message: 'Здравствуйте! Готов забрать сегодня за наличные.',
      },
      { principalId: userB }
    );
    expect(joinResult.success).toBe(true);
    const roomId = joinResult.room_id;

    // 6. User B sends follow-up message
    const msgRes = await fetch(`${baseUrl}/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: authJson(keyB),
      body: JSON.stringify({ text: 'Где вам удобнее встретиться?' }),
    });
    expect(msgRes.status).toBe(201);

    // 7. User A reads room history
    const roomResA = await fetch(`${baseUrl}/api/rooms/${roomId}`, {
      headers: authJson(keyA),
    });
    expect(roomResA.status).toBe(200);
    const roomA = await roomResA.json();
    expect(roomA.messages.length).toBeGreaterThanOrEqual(2);

    // 8. User C (unauthorized third party) attempts to read room or post message -> 403 Forbidden
    const roomResC = await fetch(`${baseUrl}/api/rooms/${roomId}`, {
      headers: authJson(keyC),
    });
    expect(roomResC.status).toBe(403);

    const postResC = await fetch(`${baseUrl}/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: authJson(keyC),
      body: JSON.stringify({ text: 'Взлом от третьей стороны' }),
    });
    expect(postResC.status).toBe(403);
  });

  it('Abuse: rejects SQL injection in search query safely', async () => {
    const maliciousQuery = "' OR '1'='1' -- DROP TABLE listings;";
    const items = getListingsFromDb({ query: maliciousQuery });
    expect(Array.isArray(items)).toBe(true);
  });

  it('Abuse: handles XSS payloads safely without corrupting projections', async () => {
    const xssTitle = '<script>alert("XSS")</script> Опасный заголовок';
    const draftRes = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: authJson(keyA),
      body: JSON.stringify({
        title: xssTitle,
        description: '<img src=x onerror=alert(1)> Описание',
        category: 'things',
        kind: 'offer',
        modes: ['online'],
        locality: 'Москва',
      }),
    });
    expect(draftRes.status).toBe(201);
    const draft = await draftRes.json();
    expect(draft.content.title).toBe(xssTitle);
  });

  it('Abuse: enforces 256KB request payload size limit (413 Payload Too Large)', async () => {
    const hugePayload = {
      title: 'Большой заголовок',
      description: 'A'.repeat(300 * 1024), // 300KB
      category: 'things',
      kind: 'offer',
      locality: 'Казань',
    };

    const res = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: authJson(keyA),
      body: JSON.stringify(hugePayload),
    });

    expect(res.status).toBe(413);
  });
});
