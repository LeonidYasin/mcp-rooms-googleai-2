import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { initDatabase } from '../server/db';
import { authJson, issueTestKey } from './auth-helpers';

describe('MCP Rooms REST API & Backend Endpoints', () => {
  let server: Server;
  let baseUrl: string;
  let apiKey: string;

  beforeAll(async () => {
    initDatabase();
    apiKey = issueTestKey('user:rest-suite').key;
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('GET /api/listings', () => {
    it('returns an array of active listings from SQLite', async () => {
      const res = await fetch(`${baseUrl}/api/listings`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('content');
      expect(data[0]).toHaveProperty('author_name');
    });

    it('filters listings by category: real_estate', async () => {
      const res = await fetch(`${baseUrl}/api/listings?category=real_estate`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      for (const item of data) {
        expect(item.content.category).toBe('real_estate');
      }
    });

    it('filters listings by category: communities', async () => {
      const res = await fetch(`${baseUrl}/api/listings?category=communities`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      for (const item of data) {
        expect(item.content.category).toBe('communities');
      }
    });

    it('searches listings by keyword query', async () => {
      const res = await fetch(`${baseUrl}/api/listings?query=коворкинг`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data.some((item: any) => item.content.title.toLowerCase().includes('коворкинг'))).toBe(true);
    });
  });

  describe('GET /api/listings/:id', () => {
    it('returns 200 and listing data for existing ID', async () => {
      const res = await fetch(`${baseUrl}/api/listings/real-estate-office-kazan-01`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe('real-estate-office-kazan-01');
      expect(data.content.title).toContain('коворкинг');
    });

    it('returns 404 for non-existent listing ID', async () => {
      const res = await fetch(`${baseUrl}/api/listings/non-existent-9999`);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('POST /api/listings', () => {
    it('creates a new listing and saves it in SQLite', async () => {
      const newListing = {
        title: 'Команда разработчиков для AI-хакатона',
        description: 'Ищем дизайнера и backend-разработчика в команду',
        category: 'communities',
        kind: 'request',
        locality: 'Казань',
        price_rubles: 0,
        author_name: 'Тестовый Капитан',
      };

      const res = await fetch(`${baseUrl}/api/listings`, {
        method: 'POST',
        headers: authJson(apiKey),
        body: JSON.stringify(newListing),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      // The owner is the authenticated principal, never a value from the body.
      expect(data.owner).toBe('user:rest-suite');
      expect(data.content.title).toBe(newListing.title);
      expect(data.content.category).toBe('communities');

      // Verify persistent fetch
      const verifyRes = await fetch(`${baseUrl}/api/listings/${data.id}`);
      expect(verifyRes.status).toBe(200);
      const verifyData = await verifyRes.json();
      expect(verifyData.content.title).toBe(newListing.title);
    });
  });

  describe('GET /api/rooms & Shared Rooms', () => {
    it('requires a key: rooms are private to their participants', async () => {
      const res = await fetch(`${baseUrl}/api/rooms`);
      expect(res.status).toBe(401);
    });

    it('returns only the rooms of the current principal', async () => {
      const res = await fetch(`${baseUrl}/api/rooms`, { headers: authJson(apiKey) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      for (const room of data) {
        expect(room.participants).toContain('user:rest-suite');
      }
    });

    it('returns 404 for invalid room ID', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/unknown-room-xyz`, {
        headers: authJson(apiKey),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/embedding/status', () => {
    it('returns current embedding provider status without errors', async () => {
      const res = await fetch(`${baseUrl}/api/embedding/status`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('provider');
      expect(data).toHaveProperty('isAvailable');
      expect(data).toHaveProperty('model');
    });
  });

  describe('POST /api/chat (Angel Agent & MCP Autonomy)', () => {
    it('processes user message and returns structured response with dynamic content', async () => {
      const chatPayload = {
        messages: [
          { role: 'user', content: 'Покажи предложения в категории Недвижимость в Казани' },
        ],
      };

      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: authJson(apiKey),
        body: JSON.stringify(chatPayload),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('text');
      expect(typeof data.text).toBe('string');
      expect(data.text.length).toBeGreaterThan(10);
      expect(data).toHaveProperty('executedTools');
      expect(Array.isArray(data.executedTools)).toBe(true);
    });

    it('gracefully handles empty or malformed requests without crashing', async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: authJson(apiKey),
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('POST /mcp (JSON-RPC 2.0 Endpoint)', () => {
    it('executes JSON-RPC tools/list call over HTTP', async () => {
      const rpcPayload = {
        jsonrpc: '2.0',
        id: 100,
        method: 'tools/list',
      };

      const res = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcPayload),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.jsonrpc).toBe('2.0');
      expect(data.id).toBe(100);
      expect(data.result).toBeDefined();
      expect(data.result.tools.length).toBeGreaterThan(0);
    });
  });
});
