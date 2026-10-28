import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import {
  addMessageToRoomInDb,
  classifyMessageInsertError,
  createRoomInDb,
  db,
  getRoomByIdFromDb,
  initDatabase,
} from '../server/db';
import { executeMcpToolCall } from '../server/mcp';
import { authJson, issueTestKey } from './auth-helpers';

/**
 * F-12 contract: a message write must fail loudly. Before this, the insert used
 * `INSERT OR IGNORE`, SQLite foreign keys were disabled, and the REST endpoint
 * answered 201 for a room that does not exist.
 */
describe('Room messages: writes never succeed silently', () => {
  let server: Server;
  let baseUrl: string;
  let key: string;
  let roomId: string;

  const run = Date.now().toString(36);
  const ownerId = `user:msg-owner-${run}`;
  const otherId = `user:msg-other-${run}`;

  const messageCount = (id: string) =>
    (db.prepare('SELECT COUNT(*) AS cnt FROM messages WHERE room_id = ?').get(id) as { cnt: number }).cnt;

  beforeAll(async () => {
    initDatabase();
    key = issueTestKey(ownerId).key;
    roomId = `room-msg-${run}`;
    createRoomInDb({
      id: roomId,
      listingTitle: 'Room message integrity',
      participants: [ownerId, otherId],
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

  it('enforces foreign keys, so a message cannot be attached to a missing room', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);

    const missing = `room-missing-${run}`;
    expect(() =>
      addMessageToRoomInDb({
        id: `msg-orphan-${run}`,
        roomId: missing,
        sender: ownerId,
        role: 'human',
        text: 'orphan message',
      })
    ).toThrow();
    expect(messageCount(missing)).toBe(0);
  });

  it('returns 404 instead of 201 for a message to an unknown room', async () => {
    const missing = `room-unknown-rest-${run}`;
    const res = await fetch(`${baseUrl}/api/rooms/${missing}/messages`, {
      method: 'POST',
      headers: authJson(key),
      body: JSON.stringify({ text: 'привет в пустоту' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('room_not_found');
    expect(messageCount(missing)).toBe(0);
  });

  it('returns an MCP error instead of success for an unknown room', async () => {
    const missing = `room-unknown-mcp-${run}`;
    const result = await executeMcpToolCall(
      'send_message',
      { room_id: missing, text: 'привет' },
      { principalId: ownerId }
    );

    expect(result.error).toBe('room_not_found');
    expect(result.success).toBeUndefined();
    expect(messageCount(missing)).toBe(0);
  });

  it('rejects a duplicate message id instead of ignoring it', () => {
    const dupRoom = `room-dup-${run}`;
    createRoomInDb({ id: dupRoom, listingTitle: 'Duplicate id room', participants: [ownerId, otherId] });

    const message = {
      id: `msg-dup-${run}`,
      roomId: dupRoom,
      sender: ownerId,
      role: 'human',
      text: 'first',
    };
    addMessageToRoomInDb(message);

    let caught: unknown;
    try {
      addMessageToRoomInDb({ ...message, text: 'second' });
    } catch (err) {
      caught = err;
    }

    expect(classifyMessageInsertError(caught)).toBe('duplicate_message_id');
    expect(messageCount(dupRoom)).toBe(1);
    // The transaction must not have replaced the stored text.
    expect(getRoomByIdFromDb(dupRoom)!.messages[0].text).toBe('first');
  });

  it('still accepts a valid message and exposes it in room history', async () => {
    const before = getRoomByIdFromDb(roomId)!;

    const res = await fetch(`${baseUrl}/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: authJson(key),
      body: JSON.stringify({ text: 'обычное сообщение' }),
    });
    expect(res.status).toBe(201);

    const created = await res.json();
    expect(created.sender).toBe(ownerId);

    const after = getRoomByIdFromDb(roomId)!;
    expect(after.messages.length).toBe(before.messages.length + 1);
    expect(after.messages.some((m) => m.id === created.id)).toBe(true);
  });
});
