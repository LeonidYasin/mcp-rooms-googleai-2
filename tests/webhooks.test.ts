import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import express from 'express';
import { app } from '../server';
import { initDatabase, createRoomInDb } from '../server/db';
import { authJson, issueTestKey } from './auth-helpers';
import { calculateWebhookSignature } from '../server/webhooks';

describe('Webhook Subsystem & Event Notifications (Issue #35)', () => {
  let mainServer: Server;
  let targetServer: Server;
  let baseUrl: string;
  let targetUrl: string;
  let key: string;

  const receivedEvents: any[] = [];
  const run = Date.now().toString(36);
  const ownerId = `user:wh-owner-${run}`;

  beforeAll(async () => {
    initDatabase();
    key = issueTestKey(ownerId).key;

    // Start target webhook endpoint mock server
    const targetApp = express();
    targetApp.use(express.json());
    targetApp.post('/webhook-receiver', (req, res) => {
      receivedEvents.push({
        headers: req.headers,
        body: req.body,
      });
      res.status(200).json({ received: true });
    });

    await new Promise<void>((resolve) => {
      targetServer = targetApp.listen(0, '127.0.0.1', () => {
        const addr = targetServer.address();
        if (addr && typeof addr === 'object') targetUrl = `http://127.0.0.1:${addr.port}/webhook-receiver`;
        resolve();
      });
    });

    // Start main API server
    await new Promise<void>((resolve) => {
      mainServer = app.listen(0, '127.0.0.1', () => {
        const addr = mainServer.address();
        if (addr && typeof addr === 'object') baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (mainServer) await new Promise<void>((resolve) => mainServer.close(() => resolve()));
    if (targetServer) await new Promise<void>((resolve) => targetServer.close(() => resolve()));
  });

  it('allows registering, listing, and deleting webhooks via REST API', async () => {
    // 1. Create webhook
    const createRes = await fetch(`${baseUrl}/api/webhooks`, {
      method: 'POST',
      headers: {
        ...authJson(key),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        events: ['message.created'],
        secret: 'test_secret_123',
      }),
    });

    expect(createRes.status).toBe(201);
    const hook = await createRes.json();
    expect(hook.id).toBeDefined();
    expect(hook.url).toBe(targetUrl);
    expect(hook.secret).toBe('test_secret_123');

    // 2. List webhooks
    const listRes = await fetch(`${baseUrl}/api/webhooks`, {
      headers: authJson(key),
    });
    expect(listRes.status).toBe(200);
    const hooks = await listRes.json();
    expect(hooks.some((h: any) => h.id === hook.id)).toBe(true);

    // 3. Delete webhook
    const delRes = await fetch(`${baseUrl}/api/webhooks/${hook.id}`, {
      method: 'DELETE',
      headers: authJson(key),
    });
    expect(delRes.status).toBe(200);
  });

  it('dispatches HMAC-signed webhook notifications when events occur', async () => {
    const hookSecret = 'my_hmac_secret_456';

    // Register active webhook
    const createRes = await fetch(`${baseUrl}/api/webhooks`, {
      method: 'POST',
      headers: {
        ...authJson(key),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        events: ['message.created'],
        secret: hookSecret,
      }),
    });
    const hook = await createRes.json();

    // Create room and post message
    const roomId = `room-wh-${run}`;
    createRoomInDb({ id: roomId, listingTitle: 'Webhook Test Room', participants: [ownerId] });

    const msgRes = await fetch(`${baseUrl}/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: {
        ...authJson(key),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Hello via Webhook!',
      }),
    });
    expect(msgRes.status).toBe(201);

    // Wait briefly for async webhook dispatch
    await new Promise((r) => setTimeout(r, 200));

    expect(receivedEvents.length).toBeGreaterThan(0);
    const latestEvent = receivedEvents[receivedEvents.length - 1];

    expect(latestEvent.headers['x-mcp-event']).toBe('message.created');
    expect(latestEvent.headers['x-mcp-signature']).toBeDefined();

    const payloadString = JSON.stringify(latestEvent.body);
    const expectedSignature = calculateWebhookSignature(hookSecret, payloadString);
    expect(latestEvent.headers['x-mcp-signature']).toBe(expectedSignature);

    // Check delivery logs REST endpoint
    const deliveriesRes = await fetch(`${baseUrl}/api/webhooks/${hook.id}/deliveries`, {
      headers: authJson(key),
    });
    expect(deliveriesRes.status).toBe(200);
    const deliveries = await deliveriesRes.json();
    expect(deliveries.length).toBeGreaterThan(0);
    expect(deliveries[0].success).toBe(true);
  });
});
