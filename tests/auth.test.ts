import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { initDatabase, revokeApiKeyInDb } from '../server/db';
import { issueApiKey } from '../server/auth';
import { authJson, authOnly, issueTestKey } from './auth-helpers';

/**
 * PR-3 contract: keys identify a principal, rooms are private to their
 * participants, and the public catalogue stays readable without a key.
 */
describe('API keys, room isolation and public read-only catalogue', () => {
  let server: Server;
  let baseUrl: string;

  // Unique principals per run so a reused test database cannot leak state.
  const run = Date.now().toString(36);
  const aliceId = `user:alice-${run}`;
  const bobId = `user:bob-${run}`;
  const malloryId = `user:mallory-${run}`;

  let aliceKey: string;
  let bobKey: string;
  let malloryKey: string;
  let listingId: string;
  let roomId: string;

  const jsonRpc = async (body: any, key?: string) => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: key ? authJson(key) : { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { res, body: await res.json() };
  };

  beforeAll(async () => {
    initDatabase();
    aliceKey = issueTestKey(aliceId).key;
    bobKey = issueTestKey(bobId).key;
    malloryKey = issueTestKey(malloryId).key;

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // Alice publishes a listing; the server must attribute it to her key.
    const created = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: authJson(aliceKey),
      body: JSON.stringify({
        title: `Переговорная у Алисы ${run}`,
        description: 'Комната для встреч, стол на шесть человек, кофе.',
        category: 'real_estate',
        kind: 'offer',
        locality: 'Казань',
        price_rubles: 1200,
      }),
    });
    expect(created.status).toBe(201);
    listingId = (await created.json()).id;

    // Bob joins through the real MCP tool.
    const joined = await jsonRpc(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'join_room',
          arguments: { listing_id: listingId, initial_message: 'Здравствуйте, хочу обсудить аренду.' },
        },
      },
      bobKey
    );
    expect(joined.res.status).toBe(200);
    roomId = joined.body.result.data.room_id;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('authentication', () => {
    it('issues a fresh isolated guest key via POST /api/auth/guest', async () => {
      const res = await fetch(`${baseUrl}/api/auth/guest`, { method: 'POST' });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.key).toMatch(/^mcr_/);
      expect(data.principalId).toMatch(/^user:guest-/);

      // Verifying guest key can authenticate
      const roomsRes = await fetch(`${baseUrl}/api/rooms`, {
        headers: { Authorization: `Bearer ${data.key}` },
      });
      expect(roomsRes.status).toBe(200);
      const rooms = await roomsRes.json();
      expect(Array.isArray(rooms)).toBe(true);
      // Fresh guest does not see other users' private rooms
      expect(rooms.length).toBe(0);
    });

    it('rejects room and write endpoints without a key', async () => {
      const requests: Array<[string, string, any?]> = [
        ['GET', '/api/rooms'],
        ['GET', `/api/rooms/${roomId}`],
        ['GET', `/api/rooms/${roomId}/stream`],
        ['POST', `/api/rooms/${roomId}/messages`, { text: 'привет' }],
        ['POST', '/api/listings', { title: 'без ключа' }],
        ['POST', '/api/chat', { messages: [{ role: 'user', content: 'привет' }] }],
        ['POST', '/api/agent/negotiate', { prompt: 'найди коворкинг' }],
        ['GET', '/api/negotiations'],
      ];
      for (const [method, path, body] of requests) {
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        expect(res.status, `${method} ${path}`).toBe(401);
      }
    });

    it('rejects tools/call without a key but keeps tools/list open', async () => {
      const call = await jsonRpc({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'search_listings', arguments: {} },
      });
      expect(call.res.status).toBe(401);
      expect(call.body.error.code).toBe(-32001);

      const list = await jsonRpc({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
      expect(list.res.status).toBe(200);
      expect(list.body.result.tools.length).toBeGreaterThan(0);
    });

    it('rejects an unknown or revoked key', async () => {
      const unknown = await fetch(`${baseUrl}/api/rooms`, {
        headers: authOnly('mcr_definitely-not-a-real-key'),
      });
      expect(unknown.status).toBe(401);

      const revoked = issueApiKey(`user:revoked-${run}`, 'revoked-in-test');
      revokeApiKeyInDb(revoked.id, Date.now());
      const res = await fetch(`${baseUrl}/api/rooms`, {
        headers: authOnly(revoked.key),
      });
      expect(res.status).toBe(401);
    });

    it('keeps the catalogue and profiles readable without a key', async () => {
      const listings = await fetch(`${baseUrl}/api/listings`);
      expect(listings.status).toBe(200);
      const list = await listings.json();
      expect(Array.isArray(list)).toBe(true);
      // Public projection: no owner principal ids, no stored vectors.
      expect(list[0]).not.toHaveProperty('owner');
      expect(list[0]).not.toHaveProperty('embedding_json');

      const card = await fetch(`${baseUrl}/api/listings/${listingId}`);
      expect(card.status).toBe(200);
      const cardData = await card.json();
      expect(cardData).not.toHaveProperty('owner');

      const profiles = await fetch(`${baseUrl}/api/profiles`);
      expect(profiles.status).toBe(200);
    });
  });

  describe('attribution', () => {
    it('stores the listing under the key owner, not a client-supplied owner', async () => {
      const res = await fetch(`${baseUrl}/api/listings`, {
        method: 'POST',
        headers: authJson(bobKey),
        body: JSON.stringify({
          title: `Карточка Боба ${run}`,
          description: 'Проверка атрибуции: owner приходит из ключа.',
          category: 'things',
          kind: 'offer',
          locality: 'Казань',
          owner: aliceId,
          author_name: 'Подставное имя',
        }),
      });
      expect(res.status).toBe(201);
      const created = await res.json();
      expect(created.owner).toBe(bobId);
      expect(created.author_name).toBe('Подставное имя');
    });

    it('stamps the message sender from the key, ignoring a spoofed sender field', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: authJson(bobKey),
        body: JSON.stringify({ sender: 'user:someone-else', role: 'human', text: 'Пишу как я' }),
      });
      expect(res.status).toBe(201);
      const message = await res.json();
      expect(message.sender).toBe(bobId);
    });
  });

  describe('room isolation', () => {
    it('lists the room for both participants only', async () => {
      const bobRooms = await (await fetch(`${baseUrl}/api/rooms`, { headers: authOnly(bobKey) })).json();
      expect(bobRooms.map((r: any) => r.id)).toContain(roomId);

      const aliceRooms = await (await fetch(`${baseUrl}/api/rooms`, { headers: authOnly(aliceKey) })).json();
      expect(aliceRooms.map((r: any) => r.id)).toContain(roomId);

      const malloryRooms = await (await fetch(`${baseUrl}/api/rooms`, { headers: authOnly(malloryKey) })).json();
      expect(malloryRooms.map((r: any) => r.id)).not.toContain(roomId);
    });

    it('returns 403 to a non-participant for read, write and stream', async () => {
      const read = await fetch(`${baseUrl}/api/rooms/${roomId}`, { headers: authOnly(malloryKey) });
      expect(read.status).toBe(403);

      const write = await fetch(`${baseUrl}/api/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: authJson(malloryKey),
        body: JSON.stringify({ text: 'чужое сообщение' }),
      });
      expect(write.status).toBe(403);

      const stream = await fetch(`${baseUrl}/api/rooms/${roomId}/stream`, {
        headers: authOnly(malloryKey),
      });
      expect(stream.status).toBe(403);
      await stream.body?.cancel();
    });

    it('lets a participant stream the room with a token query parameter', async () => {
      const res = await fetch(
        `${baseUrl}/api/rooms/${roomId}/stream?access_token=${encodeURIComponent(bobKey)}`
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      await res.body?.cancel();
    });

    it('filters rooms://all by participant and rejects it anonymously', async () => {
      const anon = await jsonRpc({
        jsonrpc: '2.0',
        id: 4,
        method: 'resources/read',
        params: { uri: 'rooms://all' },
      });
      expect(anon.res.status).toBe(401);

      const asMallory = await jsonRpc(
        {
          jsonrpc: '2.0',
          id: 5,
          method: 'resources/read',
          params: { uri: 'rooms://all' },
        },
        malloryKey
      );
      expect(asMallory.res.status).toBe(200);
      const rooms = JSON.parse(asMallory.body.result.contents[0].text);
      for (const room of rooms) {
        expect(room.participants).toContain(malloryId);
      }
      expect(rooms.map((r: any) => r.id)).not.toContain(roomId);
    });

    it('refuses MCP room tools for a non-participant', async () => {
      const history = await jsonRpc(
        {
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/call',
          params: { name: 'get_room_history', arguments: { room_id: roomId } },
        },
        malloryKey
      );
      expect(history.body.result.data.error).toBe('forbidden');
    });

    it('runs chat under the caller key and never returns 401 for a valid one', async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: authJson(bobKey),
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Покажи объявления про коворкинг' }] }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data.text).toBe('string');
      expect(Array.isArray(data.executedTools)).toBe(true);
    });
  });
});
