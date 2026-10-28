import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { initDatabase, getListingsFromDb, getNegotiationsFromDb, getRoomsFromDb } from '../server/db';
import { MCP_TOOLS_MANIFEST } from '../server/mcp';
import { authJson, issueTestKey } from './auth-helpers';

/**
 * PR-2 contract: the chat API must never report a tool call that did not happen,
 * and every degraded (no model) answer must say so explicitly.
 */
describe('Chat honesty: no synthesised tool calls', () => {
  let server: Server;
  let baseUrl: string;
  let apiKey: string;

  const manifestNames = MCP_TOOLS_MANIFEST.map((t) => t.name);

  const chat = async (content: string) => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: authJson(apiKey),
      body: JSON.stringify({ messages: [{ role: 'user', content }] }),
    });
    expect(res.status).toBe(200);
    return res.json();
  };

  beforeAll(async () => {
    initDatabase();
    apiKey = issueTestKey('user:chat-honesty').key;
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (addr && typeof addr === 'object') baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('reports only tools that exist in the server manifest', async () => {
    const data = await chat('Покажи, какие принципы приватности у площадки?');
    for (const call of data.executedTools) {
      expect(manifestNames).toContain(call.name);
    }
  });

  it('answers the privacy question without inventing an inspect_safety_guidelines tool', async () => {
    const data = await chat('Расскажи про безопасность и приватность');
    expect(data.executedTools).toEqual([]);
    expect(data.degraded).toBe(true);
    expect(typeof data.degradedReason).toBe('string');
  });

  it('returns a demo negotiation without creating a room, messages or agreement', async () => {
    const beforeRooms = getRoomsFromDb().length;
    const beforeNegotiations = getNegotiationsFromDb().length;

    const data = await chat('Договорись об аренде коворкинга в Казани');
    const names = data.executedTools.map((c: any) => c.name);
    expect(names).toEqual(['negotiate_agreement']);
    expect(names).not.toContain('join_room');
    expect(names).not.toContain('send_message');
    expect(data.degraded).toBe(true);
    expect(data.text).toContain('Демонстрационный сценарий');
    expect(data.text).toContain('ничего не отправлено');

    expect(data.negotiation.demo).toBe(true);
    expect(data.negotiation.status).toBe('demo_preview');
    expect(data.negotiation.roomId).toBeNull();
    expect(data.negotiation.demoTerms.note).toContain('не соглашение');
    expect(data.negotiation.dialogue.every((t: any) => t.simulated === true)).toBe(true);
    expect(JSON.stringify(data.negotiation)).not.toContain('safetyConfirmed');
    expect(data.createdListing).toBeNull();

    // Demo runs must not write fabricated messages or agreements anywhere.
    expect(getRoomsFromDb().length).toBe(beforeRooms);
    expect(getNegotiationsFromDb().length).toBe(beforeNegotiations);
  });

  it('does not create a listing or room when nothing matches', async () => {
    const beforeListings = getListingsFromDb({}).length;
    const beforeRooms = getRoomsFromDb().length;

    const res = await fetch(`${baseUrl}/api/agent/negotiate`, {
      method: 'POST',
      headers: authJson(apiKey),
      body: JSON.stringify({ prompt: 'Договорись о сделке', targetListingId: 'missing-listing-id' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.status).toBe('no_match');
    expect(data.demo).toBe(true);
    expect(data.roomId).toBeNull();
    expect(data.targetListing).toBeNull();
    expect(getListingsFromDb({}).length).toBe(beforeListings);
    expect(getRoomsFromDb().length).toBe(beforeRooms);
  });

  it('reports a real create_listing call when it actually created a row', async () => {
    const title = 'Тестовая карточка из чата ' + Date.now();
    const data = await chat(`Создай объявление: ${title}`);
    const names = data.executedTools.map((c: any) => c.name);
    expect(names).toEqual(['create_listing']);
    expect(data.createdListing).toBeDefined();
    expect(data.createdListing.content.title).toContain(title);
    expect(data.degraded).toBe(true);
  });

  it('exposes exactly the manifest tools over /mcp tools/list', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.tools.map((t: any) => t.name).sort()).toEqual([...manifestNames].sort());
  });
});
