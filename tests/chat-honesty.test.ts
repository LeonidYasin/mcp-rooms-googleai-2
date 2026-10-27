import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { initDatabase } from '../server/db';
import { MCP_TOOLS_MANIFEST } from '../server/mcp';

/**
 * PR-2 contract: the chat API must never report a tool call that did not happen,
 * and every degraded (no model) answer must say so explicitly.
 */
describe('Chat honesty: no synthesised tool calls', () => {
  let server: Server;
  let baseUrl: string;

  const manifestNames = MCP_TOOLS_MANIFEST.map((t) => t.name);

  const chat = async (content: string) => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content }] }),
    });
    expect(res.status).toBe(200);
    return res.json();
  };

  beforeAll(async () => {
    initDatabase();
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

  it('does not claim join_room/send_message during a rule-based negotiation', async () => {
    const data = await chat('Договорись об аренде коворкинга в Казани');
    const names = data.executedTools.map((c: any) => c.name);
    expect(names).toEqual(['negotiate_agreement']);
    expect(names).not.toContain('join_room');
    expect(names).not.toContain('send_message');
    expect(data.degraded).toBe(true);
    expect(data.text).toContain('демо-сценарий');
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
