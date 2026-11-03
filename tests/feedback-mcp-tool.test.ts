import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app, createApp } from '../server';
import { initDatabase, getFeedbackByIdFromDb, getFeedbackFromDb } from '../server/db';
import { executeMcpToolCall, handleMcpJsonRpcRequest, MCP_TOOLS_MANIFEST } from '../server/mcp';
import { issueTestKey, authJson, authOnly } from './auth-helpers';

describe('TASK-12: Modular Decomposition & Support / Feedback Subsystem', () => {
  let server: Server;
  let baseUrl: string;
  let apiKey: string;
  const testPrincipalId = 'user:feedback-tester';

  beforeAll(async () => {
    initDatabase();
    apiKey = issueTestKey(testPrincipalId).key;

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
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('createApp factory', () => {
    it('creates an Express app instance with modular routes', () => {
      const newApp = createApp();
      expect(newApp).toBeDefined();
      expect(typeof newApp.listen).toBe('function');
    });
  });

  describe('MCP Tools Manifest', () => {
    it('includes send_support_message in manifest with required parameters', () => {
      const tool = MCP_TOOLS_MANIFEST.find((t) => t.name === 'send_support_message');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toContain('message');
      expect(tool?.description).toContain('разработчикам');
    });
  });

  describe('MCP Tool Execution: send_support_message & submit_feedback', () => {
    it('rejects unauthenticated execution', async () => {
      const res = await executeMcpToolCall('send_support_message', { message: 'Тестовое сообщение' });
      expect(res.error).toBe('authentication_required');
    });

    it('rejects empty message with invalid_params', async () => {
      const res = await executeMcpToolCall(
        'send_support_message',
        { message: '   ' },
        { principalId: testPrincipalId }
      );
      expect(res.error).toBe('invalid_params');
    });

    it('successfully submits feedback ticket via send_support_message and persists in SQLite', async () => {
      const res = await executeMcpToolCall(
        'send_support_message',
        {
          message: 'Добавьте пожалуйста фильтр по городам в режиме карты',
          category: 'feature_request',
          contact: '@alex_developer',
          metadata: { client: 'vitest', version: '1.0.0' },
        },
        { principalId: testPrincipalId }
      );

      expect(res.success).toBe(true);
      expect(res.ticket_id).toBeDefined();
      expect(res.category).toBe('feature_request');
      expect(res.status).toBe('open');

      const inDb = getFeedbackByIdFromDb(res.ticket_id);
      expect(inDb).toBeDefined();
      expect(inDb?.authorId).toBe(testPrincipalId);
      expect(inDb?.message).toBe('Добавьте пожалуйста фильтр по городам в режиме карты');
      expect(inDb?.contact).toBe('@alex_developer');
      expect(inDb?.metadata).toEqual({ client: 'vitest', version: '1.0.0' });
    });

    it('supports alias submit_feedback', async () => {
      const res = await executeMcpToolCall(
        'submit_feedback',
        {
          message: 'Обнаружил баг при загрузке тяжелых изображений',
          category: 'bug_report',
        },
        { principalId: testPrincipalId }
      );

      expect(res.success).toBe(true);
      expect(res.ticket_id).toBeDefined();
      expect(res.category).toBe('bug_report');
    });

    it('handles JSON-RPC 2.0 tools/call for send_support_message', async () => {
      const rpcReq = {
        jsonrpc: '2.0',
        id: 'rpc-test-fb',
        method: 'tools/call',
        params: {
          name: 'send_support_message',
          arguments: {
            message: 'Отличная платформа! Было бы здорово иметь SDK на Python.',
            category: 'feedback',
          },
        },
      };

      const rpcRes = await handleMcpJsonRpcRequest(rpcReq, { principalId: testPrincipalId });
      expect(rpcRes.id).toBe('rpc-test-fb');
      expect(rpcRes.result).toBeDefined();
      expect(rpcRes.result.content[0].type).toBe('text');
      const parsed = JSON.parse(rpcRes.result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.ticket_id).toBeDefined();
    });
  });

  describe('REST Feedback API Endpoints', () => {
    let createdRestId = '';

    it('POST /api/feedback rejects unauthorized request', async () => {
      const res = await fetch(`${baseUrl}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello support' }),
      });
      expect(res.status).toBe(401);
    });

    it('POST /api/feedback rejects invalid body without message', async () => {
      const res = await fetch(`${baseUrl}/api/feedback`, {
        method: 'POST',
        headers: authJson(apiKey),
        body: JSON.stringify({ category: 'bug_report' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('invalid_message');
    });

    it('POST /api/feedback creates ticket and returns 201', async () => {
      const res = await fetch(`${baseUrl}/api/feedback`, {
        method: 'POST',
        headers: authJson(apiKey),
        body: JSON.stringify({
          message: 'Предлагаю интегрировать нотификации в Telegram бот',
          category: 'feature_request',
          contact: 'telegram:@leonid_dev',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.ticket).toBeDefined();
      expect(data.ticket.id).toBeDefined();
      expect(data.ticket.authorId).toBe(testPrincipalId);
      expect(data.ticket.category).toBe('feature_request');
      createdRestId = data.ticket.id;
    });

    it('GET /api/feedback returns list of user tickets', async () => {
      const res = await fetch(`${baseUrl}/api/feedback`, {
        headers: authOnly(apiKey),
      });

      expect(res.status).toBe(200);
      const list = await res.json();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      const found = list.find((t: any) => t.id === createdRestId);
      expect(found).toBeDefined();
      expect(found.message).toBe('Предлагаю интегрировать нотификации в Telegram бот');
    });
  });
});
