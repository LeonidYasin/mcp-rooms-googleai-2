import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { initDatabase, createRoomInDb, addMessageToRoomInDb } from '../server/db';
import { handleMcpJsonRpcRequest, executeMcpToolCall } from '../server/mcp';
import { roomEventBus } from '../server/events';
import { authJson, issueTestKey } from './auth-helpers';

describe('MCP Spec Protocol & SSE Replay/Limits (PR-4 & PR-8)', () => {
  let server: Server;
  let baseUrl: string;
  let key: string;

  const run = Date.now().toString(36);
  const ownerId = `user:spec-owner-${run}`;

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
    if (typeof (server as any).closeAllConnections === 'function') {
      (server as any).closeAllConnections();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('handles MCP initialize, notifications/initialized, and ping', async () => {
    // 1. Initialize
    const initRes = await handleMcpJsonRpcRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' },
    });
    expect(initRes.jsonrpc).toBe('2.0');
    expect(initRes.id).toBe(1);
    expect(initRes.result.protocolVersion).toBe('2024-11-05');
    expect(initRes.result.serverInfo.name).toBe('mcp-rooms');
    expect(initRes.result.sessionId).toBeDefined();

    // 2. Initialized Notification
    const notifRes = await handleMcpJsonRpcRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'notifications/initialized',
    });
    expect(notifRes.result.initialized).toBe(true);

    // 3. Ping
    const pingRes = await handleMcpJsonRpcRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'ping',
    });
    expect(pingRes.result).toEqual({});
  });

  it('validates MCP tool parameters and returns invalid_params error for bad inputs', async () => {
    // Missing query for match_listings
    const matchRes = await executeMcpToolCall('match_listings', {});
    expect(matchRes.error).toBe('invalid_params');

    // Missing profile_id for get_profile
    const profileRes = await executeMcpToolCall('get_profile', {});
    expect(profileRes.error).toBe('invalid_params');
  });

  it('persists room events in SQLite and replays missed events based on Last-Event-ID', async () => {
    const roomId = `room-event-store-${run}`;
    createRoomInDb({ id: roomId, listingTitle: 'Event Store Test', participants: [ownerId] });

    const ev1 = roomEventBus.broadcast(roomId, 'turn', { round: 1, text: 'Round 1 Event' });
    const ev2 = roomEventBus.broadcast(roomId, 'turn', { round: 2, text: 'Round 2 Event' });
    const ev3 = roomEventBus.broadcast(roomId, 'turn', { round: 3, text: 'Round 3 Event' });

    // Request SSE stream with Last-Event-ID = ev1.id -> should replay ev2 and ev3 from room_events
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/rooms/${roomId}/stream`, {
      signal: controller.signal,
      headers: {
        ...authJson(key),
        'Last-Event-ID': ev1.id,
      },
    });

    expect(res.status).toBe(200);
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    let fullText = '';
    while (true) {
      const { value, done } = await reader!.read();
      if (done || !value) break;
      fullText += new TextDecoder().decode(value);
      if (fullText.includes('Round 3 Event')) {
        break;
      }
    }
    controller.abort();

    expect(fullText).toContain('Round 2 Event');
    expect(fullText).toContain('Round 3 Event');
    expect(fullText).not.toContain('Round 1 Event');
  });

  it('replays room messages based on Last-Event-ID header', async () => {
    const roomId = `room-replay-${run}`;
    createRoomInDb({ id: roomId, listingTitle: 'Replay Test', participants: [ownerId] });

    const t1 = 100000;
    const t2 = 200000;
    const t3 = 300000;

    addMessageToRoomInDb({ id: `msg-${run}-${t1}`, roomId, sender: ownerId, role: 'human', text: 'Msg 1', timestamp: t1 });
    addMessageToRoomInDb({ id: `msg-${run}-${t2}`, roomId, sender: ownerId, role: 'human', text: 'Msg 2', timestamp: t2 });
    addMessageToRoomInDb({ id: `msg-${run}-${t3}`, roomId, sender: ownerId, role: 'human', text: 'Msg 3', timestamp: t3 });

    // Request stream with Last-Event-ID = msg-100000 -> should only replay msg-200000 and msg-300000
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/rooms/${roomId}/stream`, {
      signal: controller.signal,
      headers: {
        ...authJson(key),
        'Last-Event-ID': `msg-${run}-${t1}`,
      },
    });

    expect(res.status).toBe(200);
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    let fullText = '';
    while (true) {
      const { value, done } = await reader!.read();
      if (done || !value) break;
      fullText += new TextDecoder().decode(value);
      if (fullText.includes('Msg 3')) {
        break;
      }
    }
    controller.abort();

    expect(fullText).toContain('Msg 2');
    expect(fullText).toContain('Msg 3');
    expect(fullText).not.toContain('Msg 1');
  });

  it('enforces 429 subscriber limit when subscriber count hits maximum', async () => {
    const roomId = `room-sub-limit-${run}`;
    createRoomInDb({ id: roomId, listingTitle: 'Subscriber Limit Test', participants: [ownerId] });

    // Simulate 50 active subscribers on the event bus
    const unsubscribes: (() => void)[] = [];
    for (let i = 0; i < 50; i++) {
      unsubscribes.push(roomEventBus.subscribe(roomId, () => {}));
    }

    // The 51st connection request must receive 429
    const res = await fetch(`${baseUrl}/api/rooms/${roomId}/stream`, {
      headers: authJson(key),
    });

    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe('too_many_subscribers');

    // Clean up simulated subscriptions
    unsubscribes.forEach((unsub) => unsub());
  });
});
