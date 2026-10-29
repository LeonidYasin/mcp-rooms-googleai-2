import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { initDatabase, createRoomInDb, addMessageToRoomInDb } from '../server/db';
import { authJson, issueTestKey } from './auth-helpers';

describe('SSE Replay & Last-Event-ID Handling (Issue #31)', () => {
  let server: Server;
  let baseUrl: string;
  let key: string;

  const run = Date.now().toString(36);
  const ownerId = `user:replay-owner-${run}`;

  beforeAll(async () => {
    initDatabase();
    key = issueTestKey(ownerId).key;

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

  it('replays missing messages when Last-Event-ID is sent in header', async () => {
    const roomId = `room-replay-hdr-${run}`;
    createRoomInDb({ id: roomId, listingTitle: 'Header Replay Test', participants: [ownerId] });

    const t1 = 1000;
    const t2 = 2000;
    const t3 = 3000;

    addMessageToRoomInDb({ id: `msg-hdr-${run}-${t1}`, roomId, sender: ownerId, role: 'human', text: 'First msg', timestamp: t1 });
    addMessageToRoomInDb({ id: `msg-hdr-${run}-${t2}`, roomId, sender: ownerId, role: 'human', text: 'Second msg', timestamp: t2 });
    addMessageToRoomInDb({ id: `msg-hdr-${run}-${t3}`, roomId, sender: ownerId, role: 'human', text: 'Third msg', timestamp: t3 });

    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/rooms/${roomId}/stream`, {
      signal: controller.signal,
      headers: {
        ...authJson(key),
        'Last-Event-ID': `msg-hdr-${run}-${t1}`,
      },
    });

    expect(res.status).toBe(200);
    const reader = res.body?.getReader();
    const { value } = await reader!.read();
    const chunk = new TextDecoder().decode(value);
    controller.abort();

    expect(chunk).toContain('Second msg');
    expect(chunk).toContain('Third msg');
    expect(chunk).not.toContain('First msg');
  });

  it('replays missing messages when lastEventId is passed as query parameter', async () => {
    const roomId = `room-replay-query-${run}`;
    createRoomInDb({ id: roomId, listingTitle: 'Query Replay Test', participants: [ownerId] });

    const t1 = 1000;
    const t2 = 2000;

    addMessageToRoomInDb({ id: `msg-qry-${run}-${t1}`, roomId, sender: ownerId, role: 'human', text: 'Old msg', timestamp: t1 });
    addMessageToRoomInDb({ id: `msg-qry-${run}-${t2}`, roomId, sender: ownerId, role: 'human', text: 'New msg', timestamp: t2 });

    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/rooms/${roomId}/stream?lastEventId=msg-qry-${run}-${t1}`, {
      signal: controller.signal,
      headers: authJson(key),
    });

    expect(res.status).toBe(200);
    const reader = res.body?.getReader();
    const { value } = await reader!.read();
    const chunk = new TextDecoder().decode(value);
    controller.abort();

    expect(chunk).toContain('New msg');
    expect(chunk).not.toContain('Old msg');
  });
});
