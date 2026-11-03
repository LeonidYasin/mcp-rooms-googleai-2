import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http, { type Server } from 'http';
import crypto from 'crypto';
import { app } from '../server';
import {
  initDatabase,
  saveWebhookInDb,
  getWebhooksFromDb,
  getWebhookByIdFromDb,
  deleteWebhookFromDb,
  updateWebhookDeliveryStatsInDb,
} from '../server/db';
import {
  computeWebhookSignature,
  generateWebhookSecret,
  deliverWebhook,
  dispatchWebhooksForEvent,
} from '../server/webhooks';
import { issueTestKey, authJson, authOnly } from './auth-helpers';

describe('TASK-09: Agent Webhook Subsystem & Async Event Delivery', () => {
  beforeAll(() => {
    initDatabase();
  });

  describe('HMAC-SHA256 Signing & Secret Generation', () => {
    it('generates secure prefixed secrets', () => {
      const secret = generateWebhookSecret();
      expect(secret.startsWith('whsec_')).toBe(true);
      expect(secret.length).toBeGreaterThanOrEqual(30);
    });

    it('computes valid sha256 HMAC signature', () => {
      const secret = 'test-secret-123';
      const payload = JSON.stringify({ event: 'message', data: { text: 'hello' } });
      const signature = computeWebhookSignature(secret, payload);

      expect(signature.startsWith('sha256=')).toBe(true);
      const expectedDigest = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      expect(signature).toBe(`sha256=${expectedDigest}`);
    });
  });

  describe('Database Persistence & Lifecycle', () => {
    const agentId = 'user:wh-agent-01';
    let webhookId = '';

    it('saves a new webhook and retrieves it by id and agent', () => {
      webhookId = 'wh-test-' + Date.now();
      const secret = generateWebhookSecret();

      const created = saveWebhookInDb({
        id: webhookId,
        agentId,
        targetUrl: 'https://agent.example.com/webhook',
        secret,
        events: ['message', 'agreement'],
        status: 'active',
      });

      expect(created.id).toBe(webhookId);
      expect(created.agentId).toBe(agentId);
      expect(created.targetUrl).toBe('https://agent.example.com/webhook');
      expect(created.events).toEqual(['message', 'agreement']);
      expect(created.status).toBe('active');

      const fetched = getWebhookByIdFromDb(webhookId);
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(webhookId);

      const agentWebhooks = getWebhooksFromDb(agentId);
      expect(agentWebhooks.some((w) => w.id === webhookId)).toBe(true);
    });

    it('updates delivery statistics on success and failure', () => {
      updateWebhookDeliveryStatsInDb(webhookId, true);
      let wh = getWebhookByIdFromDb(webhookId);
      expect(wh?.lastDeliveredAt).toBeDefined();
      expect(wh?.failureCount).toBe(0);

      updateWebhookDeliveryStatsInDb(webhookId, false);
      wh = getWebhookByIdFromDb(webhookId);
      expect(wh?.failureCount).toBe(1);
    });

    it('deletes webhook safely', () => {
      const deleted = deleteWebhookFromDb(webhookId, agentId);
      expect(deleted).toBe(true);

      const fetched = getWebhookByIdFromDb(webhookId);
      expect(fetched).toBeNull();
    });
  });

  describe('Real HTTP Delivery & Retry Mechanism', () => {
    let mockServer: http.Server;
    let serverPort: number;
    let receivedRequests: Array<{ headers: http.IncomingHttpHeaders; body: any }> = [];
    let shouldFail = false;

    beforeAll(async () => {
      receivedRequests = [];
      mockServer = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          if (shouldFail) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
            return;
          }

          try {
            const parsed = JSON.parse(body);
            receivedRequests.push({ headers: req.headers, body: parsed });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ received: true }));
          } catch {
            res.writeHead(400);
            res.end('invalid json');
          }
        });
      });

      await new Promise<void>((resolve) => {
        mockServer.listen(0, '127.0.0.1', () => {
          const addr = mockServer.address() as any;
          serverPort = addr.port;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    });

    it('delivers webhook with correct headers, signature, and body', async () => {
      receivedRequests = [];
      shouldFail = false;

      const secret = 'test-secret-deliv';
      const testWh = {
        id: 'wh-deliv-01',
        agentId: 'user:agent-test',
        targetUrl: `http://127.0.0.1:${serverPort}/webhook`,
        secret,
        events: ['*'],
        status: 'active' as const,
        createdAt: Date.now(),
        failureCount: 0,
      };

      const result = await deliverWebhook(testWh, 'message', { text: 'Привет контрагенту' }, {
        maxRetries: 2,
        initialDelayMs: 50,
      });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.attempts).toBe(1);

      expect(receivedRequests.length).toBe(1);
      const req = receivedRequests[0];
      expect(req.headers['x-mcp-event']).toBe('message');
      expect(req.headers['x-mcp-delivery']).toBeDefined();
      expect(req.headers['x-mcp-signature']).toBeDefined();

      // Verify signature on receiver side
      const expectedSig = computeWebhookSignature(secret, JSON.stringify(req.body));
      expect(req.headers['x-mcp-signature']).toBe(expectedSig);
      expect(req.body.data.text).toBe('Привет контрагенту');
    });

    it('retries up to maxRetries on remote error and marks failure', async () => {
      receivedRequests = [];
      shouldFail = true;

      const testWh = {
        id: 'wh-retry-01',
        agentId: 'user:agent-test',
        targetUrl: `http://127.0.0.1:${serverPort}/webhook`,
        secret: 'retry-secret',
        events: ['*'],
        status: 'active' as const,
        createdAt: Date.now(),
        failureCount: 0,
      };

      const result = await deliverWebhook(testWh, 'agreement', { deal: true }, {
        maxRetries: 2,
        initialDelayMs: 20,
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.attempts).toBe(2);
    });
  });

  describe('REST Webhooks API Endpoints', () => {
    let apiServer: Server;
    let baseUrl: string;
    let apiKey: string;
    let createdId = '';

    beforeAll(async () => {
      apiKey = issueTestKey('user:wh-rest-suite').key;
      await new Promise<void>((resolve) => {
        apiServer = app.listen(0, '127.0.0.1', () => {
          const addr = apiServer.address();
          if (addr && typeof addr === 'object') {
            baseUrl = `http://127.0.0.1:${addr.port}`;
          }
          resolve();
        });
      });
    });

    afterAll(async () => {
      if (apiServer) {
        await new Promise<void>((resolve) => apiServer.close(() => resolve()));
      }
    });

    it('POST /api/webhooks validates URL and registers a new webhook', async () => {
      const res = await fetch(`${baseUrl}/api/webhooks`, {
        method: 'POST',
        headers: authJson(apiKey),
        body: JSON.stringify({
          target_url: 'https://my-agent.io/mcp-events',
          events: ['message', 'agreement'],
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.targetUrl).toBe('https://my-agent.io/mcp-events');
      expect(data.secret).toMatch(/^whsec_/);
      expect(data.events).toEqual(['message', 'agreement']);
      createdId = data.id;
    });

    it('POST /api/webhooks rejects invalid URL with 400', async () => {
      const res = await fetch(`${baseUrl}/api/webhooks`, {
        method: 'POST',
        headers: authJson(apiKey),
        body: JSON.stringify({
          target_url: 'not-a-valid-url',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('invalid_url');
    });

    it('GET /api/webhooks returns list of registered webhooks with masked secrets', async () => {
      const res = await fetch(`${baseUrl}/api/webhooks`, {
        headers: authOnly(apiKey),
      });

      expect(res.status).toBe(200);
      const list = await res.json();
      expect(Array.isArray(list)).toBe(true);
      const wh = list.find((w: any) => w.id === createdId);
      expect(wh).toBeDefined();
      expect(wh.secret).toContain('...');
    });

    it('DELETE /api/webhooks/:id deletes webhook', async () => {
      const res = await fetch(`${baseUrl}/api/webhooks/${createdId}`, {
        method: 'DELETE',
        headers: authOnly(apiKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const check = await fetch(`${baseUrl}/api/webhooks/${createdId}`, {
        method: 'DELETE',
        headers: authOnly(apiKey),
      });

      expect(check.status).toBe(404);
    });
  });
});
