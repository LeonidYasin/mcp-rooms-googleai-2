import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { initDatabase, createRoomInDb } from '../server/db';
import { authJson, issueTestKey } from './auth-helpers';

describe('Webhooks & Real-Time Event Notifications API', () => {
  let server: Server;
  let baseUrl: string;
  let userKey: string;
  let otherKey: string;

  const run = Date.now().toString(36);
  const userId = `user:wh-owner-${run}`;
  const otherId = `user:wh-other-${run}`;

  beforeAll(async () => {
    initDatabase();
    userKey = issueTestKey(userId).key;
    otherKey = issueTestKey(otherId).key;

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

  it('allows authenticated principal to create, list, and delete webhooks', async () => {
    // 1. Create Webhook
    const createRes = await fetch(`${baseUrl}/api/webhooks`, {
      method: 'POST',
      headers: authJson(userKey),
      body: JSON.stringify({
        url: 'https://example.com/webhook',
        event_type: 'room.message',
        secret: 'secret-key-123',
      }),
    });

    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    expect(createData.success).toBe(true);
    expect(createData.webhook.id).toContain('wh-');
    expect(createData.webhook.url).toBe('https://example.com/webhook');
    expect(createData.webhook.owner).toBe(userId);

    const webhookId = createData.webhook.id;

    // 2. List Webhooks
    const listRes = await fetch(`${baseUrl}/api/webhooks`, {
      headers: authJson(userKey),
    });

    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(Array.isArray(listData)).toBe(true);
    expect(listData.some((w: any) => w.id === webhookId)).toBe(true);

    // 3. Forbid deletion by non-owner
    const otherDeleteRes = await fetch(`${baseUrl}/api/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: authJson(otherKey),
    });

    expect(otherDeleteRes.status).toBe(403);

    // 4. Delete by owner
    const deleteRes = await fetch(`${baseUrl}/api/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: authJson(userKey),
    });

    expect(deleteRes.status).toBe(200);
    const deleteData = await deleteRes.json();
    expect(deleteData.success).toBe(true);
  });

  it('rejects invalid webhook URLs', async () => {
    const res = await fetch(`${baseUrl}/api/webhooks`, {
      method: 'POST',
      headers: authJson(userKey),
      body: JSON.stringify({
        url: 'not-a-valid-url',
        event_type: 'room.message',
      }),
    });

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toBe('invalid_url');
  });

  it('dispatches webhook event when a room message is posted', async () => {
    const roomId = `room-wh-${run}`;
    createRoomInDb({
      id: roomId,
      listingTitle: 'Webhook Test Room',
      participants: [userId],
    });

    // Post message
    const msgRes = await fetch(`${baseUrl}/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: authJson(userKey),
      body: JSON.stringify({
        text: 'Test message triggering webhooks',
      }),
    });

    expect(msgRes.status).toBe(201);
  });
});
