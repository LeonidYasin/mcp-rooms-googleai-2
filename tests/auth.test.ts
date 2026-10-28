import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { db, disableUserInDb, initDatabase, revokeCredentialInDb } from '../server/db';
import { authJson, authOnly, ensureTestUser, issueTestKey } from './auth-helpers';

/**
 * PR-4 contract: credentials carry scopes and an expiry, `/identity` describes
 * the caller without leaking the secret, delegation cannot widen a grant, and
 * no endpoint accepts a token in the query string.
 */
describe('Identity contract: scopes, expiry, delegation and no token in URLs', () => {
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
        ['GET', '/identity'],
        ['POST', '/credentials', {}],
        ['DELETE', '/credentials/current'],
      ];
      for (const [method, path, body] of requests) {
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        expect(res.status, `${method} ${path}`).toBe(401);
        if (res.status === 401) {
          expect(res.headers.get('www-authenticate')).toContain('Bearer');
        }
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

    it('rejects a malformed, unknown, revoked, expired or disabled credential', async () => {
      for (const token of ['mcr_definitely-not-a-real-key', 'mcr_' + 'a'.repeat(32) + '.' + 'b'.repeat(43)]) {
        const res = await fetch(`${baseUrl}/api/rooms`, { headers: authOnly(token) });
        expect(res.status).toBe(401);
      }

      const revoked = issueTestKey(`user:revoked-${run}`);
      revokeCredentialInDb(revoked.id, Date.now());
      const revokedRes = await fetch(`${baseUrl}/api/rooms`, { headers: authOnly(revoked.key) });
      expect(revokedRes.status).toBe(401);

      const expired = issueTestKey(`user:expired-${run}`);
      db.prepare('UPDATE credentials SET expires_at = ? WHERE id = ?').run(Date.now() - 1, expired.id);
      const expiredRes = await fetch(`${baseUrl}/api/rooms`, { headers: authOnly(expired.key) });
      expect(expiredRes.status).toBe(401);

      const disabledId = ensureTestUser(`user:disabled-${run}`);
      const disabled = issueTestKey(disabledId);
      disableUserInDb(disabledId);
      const disabledRes = await fetch(`${baseUrl}/api/rooms`, { headers: authOnly(disabled.key) });
      expect(disabledRes.status).toBe(401);
    });
  });

  describe('GET /identity', () => {
    it('describes the caller and never returns the secret', async () => {
      const res = await fetch(`${baseUrl}/identity`, { headers: authOnly(bobKey) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user_id).toBe(bobId);
      expect(body.credential_id).toMatch(/^[0-9a-f]{32}$/);
      expect(body.scopes).toEqual(
        expect.arrayContaining(['rooms:read', 'rooms:write', 'listings:read', 'listings:write'])
      );
      expect(body.expires_at).toBeGreaterThan(Date.now());
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain(bobKey);
      expect(serialized).not.toContain('digest');
    });

    it('rejects a token passed in the query string', async () => {
      const res = await fetch(`${baseUrl}/identity?access_token=${encodeURIComponent(bobKey)}`);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('query_not_supported');
    });
  });

  describe('scopes', () => {
    it('lets a rooms:read+listings:read key read but not write', async () => {
      const reader = issueTestKey(`user:reader-${run}`, {
        scopes: ['rooms:read', 'listings:read'],
      });

      const rooms = await fetch(`${baseUrl}/api/rooms`, { headers: authOnly(reader.key) });
      expect(rooms.status).toBe(200);

      const message = await fetch(`${baseUrl}/api/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: authJson(reader.key),
        body: JSON.stringify({ text: 'только чтение' }),
      });
      expect(message.status).toBe(403);
      expect((await message.json()).required_scope).toBe('rooms:write');

      const listing = await fetch(`${baseUrl}/api/listings`, {
        method: 'POST',
        headers: authJson(reader.key),
        body: JSON.stringify({
          title: 'Не должно создаться',
          description: 'Ключ без listings:write не может публиковать.',
          category: 'things',
          kind: 'offer',
          locality: 'Казань',
        }),
      });
      expect(listing.status).toBe(403);
      expect((await listing.json()).error).toBe('insufficient_scope');

      const search = await jsonRpc(
        {
          jsonrpc: '2.0',
          id: 10,
          method: 'tools/call',
          params: { name: 'search_listings', arguments: {} },
        },
        reader.key
      );
      expect(search.body.result.data.items.length).toBeGreaterThan(0);

      const create = await jsonRpc(
        {
          jsonrpc: '2.0',
          id: 11,
          method: 'tools/call',
          params: {
            name: 'create_listing',
            arguments: {
              title: 'Через MCP',
              description: 'Ключ без listings:write не должен создавать объявление.',
              category: 'things',
              kind: 'offer',
              locality: 'Казань',
            },
          },
        },
        reader.key
      );
      expect(create.body.result.data.error).toBe('insufficient_scope');
      expect(create.body.result.data.required_scope).toBe('listings:write');
    });

    it('keeps public read-only routes open without a key', async () => {
      const listings = await fetch(`${baseUrl}/api/listings`);
      expect(listings.status).toBe(200);
      const list = await listings.json();
      expect(Array.isArray(list)).toBe(true);
      // Public projection: no owner principal ids, no stored vectors.
      expect(list[0]).not.toHaveProperty('owner');
      expect(list[0]).not.toHaveProperty('embedding_json');

      const card = await fetch(`${baseUrl}/api/listings/${listingId}`);
      expect(card.status).toBe(200);
      expect(await card.json()).not.toHaveProperty('owner');

      expect((await fetch(`${baseUrl}/api/profiles`)).status).toBe(200);
    });
  });

  describe('delegation', () => {
    it('issues a narrower-or-equal copy and revokes only the copy', async () => {
      const source = issueTestKey(`user:delegator-${run}`, {
        scopes: ['rooms:read', 'rooms:write'],
        days: 3,
      });

      const delegated = await fetch(`${baseUrl}/api/credentials`, {
        method: 'POST',
        headers: authJson(source.key),
        body: JSON.stringify({ days: 90 }),
      });
      expect(delegated.status).toBe(201);
      const copy = await delegated.json();
      expect(copy.key).toMatch(/^mcr_[0-9a-f]{32}\.[A-Za-z0-9_-]{43}$/);
      expect(copy.scopes.sort()).toEqual(['rooms:read', 'rooms:write']);

      const sourceIdentity = await (await fetch(`${baseUrl}/identity`, { headers: authOnly(source.key) })).json();
      expect(copy.expires_at).toBeLessThanOrEqual(sourceIdentity.expires_at);

      const copyIdentity = await fetch(`${baseUrl}/identity`, { headers: authOnly(copy.key) });
      expect(copyIdentity.status).toBe(200);
      expect((await copyIdentity.json()).user_id).toBe(`user:delegator-${run}`);

      const revoke = await fetch(`${baseUrl}/credentials/current`, {
        method: 'DELETE',
        headers: authOnly(copy.key),
      });
      expect(revoke.status).toBe(204);

      expect((await fetch(`${baseUrl}/identity`, { headers: authOnly(copy.key) })).status).toBe(401);
      expect((await fetch(`${baseUrl}/identity`, { headers: authOnly(source.key) })).status).toBe(200);
    });

    it('rejects malformed delegation input', async () => {
      const res = await fetch(`${baseUrl}/credentials`, {
        method: 'POST',
        headers: authJson(bobKey),
        body: JSON.stringify({ days: 'soon' }),
      });
      expect(res.status).toBe(422);
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
      expect((await res.json()).sender).toBe(bobId);
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

    it('streams with an Authorization header and rejects a query token', async () => {
      const viaQuery = await fetch(
        `${baseUrl}/api/rooms/${roomId}/stream?access_token=${encodeURIComponent(bobKey)}`
      );
      expect(viaQuery.status).toBe(400);
      expect((await viaQuery.json()).error).toBe('query_not_supported');

      const viaHeader = await fetch(`${baseUrl}/api/rooms/${roomId}/stream`, {
        headers: authOnly(bobKey),
      });
      expect(viaHeader.status).toBe(200);
      expect(viaHeader.headers.get('content-type')).toContain('text/event-stream');
      await viaHeader.body?.cancel();
    });

    it('rejects query strings on /mcp', async () => {
      const res = await fetch(`${baseUrl}/mcp?access_token=${encodeURIComponent(bobKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 12, method: 'tools/list' }),
      });
      expect(res.status).toBe(400);
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
  });

  describe('chat', () => {
    it('runs under the caller key and never returns 401 for a valid one', async () => {
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
