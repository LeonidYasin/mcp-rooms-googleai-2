import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import {
  createRoomInDb,
  getRoomByIdFromDb,
  getRoomsFromDb,
  initDatabase,
} from '../server/db';
import { executeMcpToolCall } from '../server/mcp';
import { authJson, authOnly, issueTestKey } from './auth-helpers';

describe('Rooms Visibility & Unified Topics Catalog', () => {
  let server: Server;
  let baseUrl: string;

  const run = Date.now().toString(36);
  const alice = `user:alice-${run}`;
  const bob = `user:bob-${run}`;
  const eve = `user:eve-${run}`;

  let aliceKey: string;
  let bobKey: string;
  let eveKey: string;

  let publicRoomId: string;
  let privateRoomId: string;

  beforeAll(async () => {
    initDatabase();
    aliceKey = issueTestKey(alice).key;
    bobKey = issueTestKey(bob).key;
    eveKey = issueTestKey(eve).key;

    publicRoomId = `room-public-${run}`;
    createRoomInDb({
      id: publicRoomId,
      listingTitle: 'Открытое обсуждение B2B проекта',
      category: 'business',
      participants: [alice, bob],
      visibility: 'public',
    });

    privateRoomId = `room-private-${run}`;
    createRoomInDb({
      id: privateRoomId,
      listingTitle: 'Приватные 1-на-1 переговоры',
      category: 'business',
      participants: [alice, bob],
      visibility: 'private',
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

  describe('GET /api/public/rooms (Unauthenticated Public Catalog)', () => {
    it('allows guests without any key to list open public rooms', async () => {
      const res = await fetch(`${baseUrl}/api/public/rooms`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      // All returned rooms must have visibility === 'public'
      for (const r of data) {
        expect(r.visibility).toBe('public');
      }
      expect(data.some((r: any) => r.id === publicRoomId)).toBe(true);
      expect(data.some((r: any) => r.id === privateRoomId)).toBe(false);
    });

    it('filters public rooms by category', async () => {
      const res = await fetch(`${baseUrl}/api/public/rooms?category=business`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((r: any) => r.id === publicRoomId)).toBe(true);
    });
  });

  describe('GET /api/rooms/:id (Granular Access Control)', () => {
    it('allows anyone to read a public room without an API key', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${publicRoomId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(publicRoomId);
      expect(data.visibility).toBe('public');
    });

    it('returns 401 when reading a private room without an API key', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${privateRoomId}`);
      expect(res.status).toBe(401);
    });

    it('returns 403 when a third party (Eve) attempts to read a private room', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${privateRoomId}`, {
        headers: authOnly(eveKey),
      });
      expect(res.status).toBe(403);
    });

    it('allows room participants (Alice) to read their private room', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${privateRoomId}`, {
        headers: authOnly(aliceKey),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(privateRoomId);
    });
  });

  describe('POST /api/rooms/:id/messages (Posting Permissions)', () => {
    it('allows an authenticated user (Eve) to post in a public room and auto-joins as participant', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${publicRoomId}/messages`, {
        method: 'POST',
        headers: authJson(eveKey),
        body: JSON.stringify({ text: 'Привет! Интересует ваш B2B проект.' }),
      });
      expect(res.status).toBe(201);
      const msg = await res.json();
      expect(msg.sender).toBe(eve);

      // Verify that Eve is now added as a participant in SQLite
      const updatedRoom = getRoomByIdFromDb(publicRoomId);
      expect(updatedRoom?.participants).toContain(eve);
    });

    it('rejects a non-participant (Eve) posting in a private room with 403', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${privateRoomId}/messages`, {
        method: 'POST',
        headers: authJson(eveKey),
        body: JSON.stringify({ text: 'Попытка вмешательства в приватную сделку' }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/rooms (Room Creation via REST)', () => {
    it('allows an authenticated user to create a new public room', async () => {
      const res = await fetch(`${baseUrl}/api/rooms`, {
        method: 'POST',
        headers: authJson(aliceKey),
        body: JSON.stringify({
          title: 'Новая тема для сообщества',
          category: 'communities',
          visibility: 'public',
          initialMessage: 'Добро пожаловать в тему!',
        }),
      });
      expect(res.status).toBe(201);
      const created = await res.json();
      expect(created.visibility).toBe('public');
      expect(created.participants).toContain(alice);
      expect(created.messages.length).toBe(1);
    });
  });

  describe('MCP Tools: join_room & get_room_history with visibility', () => {
    it('join_room supports visibility: public', async () => {
      const result = await executeMcpToolCall(
        'join_room',
        {
          listing_id: 'biz-partner-ai-01',
          initial_message: 'Вопрос по стеку MCP от агента',
          visibility: 'public',
        },
        { principalId: alice }
      );

      expect(result.success).toBe(true);
      expect(result.visibility).toBe('public');
    });

    it('get_room_history allows non-participant to inspect public room', async () => {
      const result = await executeMcpToolCall(
        'get_room_history',
        { room_id: publicRoomId },
        { principalId: eve }
      );

      expect(result.room_id).toBe(publicRoomId);
      expect(result.visibility).toBe('public');
      expect(result.messages).toBeDefined();
    });

    it('get_room_history rejects non-participant for private room', async () => {
      const result = await executeMcpToolCall(
        'get_room_history',
        { room_id: privateRoomId },
        { principalId: eve }
      );

      expect(result.error).toBe('forbidden');
    });
  });
});
