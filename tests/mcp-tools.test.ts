import { describe, it, expect, beforeAll } from 'vitest';
import { executeMcpToolCall, handleMcpJsonRpcRequest, MCP_TOOLS_MANIFEST } from '../server/mcp';
import { initDatabase, getListingByIdFromDb, getRoomByIdFromDb, createRoomInDb } from '../server/db';

describe('Model Context Protocol (MCP) Tools & JSON-RPC Protocol', () => {
  beforeAll(() => {
    initDatabase();
  });

  describe('MCP Tools Manifest', () => {
    it('manifest defines all required autonomous tools', () => {
      const toolNames = MCP_TOOLS_MANIFEST.map((t) => t.name);
      expect(toolNames).toContain('search_listings');
      expect(toolNames).toContain('match_listings');
      expect(toolNames).toContain('create_listing');
      expect(toolNames).toContain('join_room');
      expect(toolNames).toContain('send_message');
      expect(toolNames).toContain('get_room_history');
      expect(toolNames).toContain('negotiate_agreement');
    });
  });

  describe('executeMcpToolCall', () => {
    it('search_listings returns listings matching category or query', async () => {
      const result = await executeMcpToolCall('search_listings', {
        category: 'real_estate',
      });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.total_found).toBeGreaterThan(0);
      expect(result.items.some((l: any) => l.category === 'real_estate')).toBe(true);
    });

    it('create_listing saves a new listing to SQLite and returns created item', async () => {
      const testTitle = 'Тестовая аренда переговорной комнаты ' + Date.now();
      const result = await executeMcpToolCall('create_listing', {
        title: testTitle,
        description: 'Оборудованная комната для встреч с проектором и доской',
        category: 'real_estate',
        kind: 'offer',
        locality: 'Казань',
        price_rubles: 1500,
        modes: ['pickup'],
        condition: 'Отличное',
      });

      expect(result.success).toBe(true);
      expect(result.created_listing).toBeDefined();
      expect(result.created_listing.id).toBeDefined();
      expect(result.created_listing.content.title).toBe(testTitle);

      // Verify persistence in SQLite
      const fromDb = getListingByIdFromDb(result.created_listing.id);
      expect(fromDb).toBeDefined();
      expect(fromDb?.content.title).toBe(testTitle);
      expect(fromDb?.content.category).toBe('real_estate');
    });

    it('join_room, send_message, and get_room_history manage shared room lifecycle', async () => {
      // 1. Join / create room
      const joinResult = await executeMcpToolCall('join_room', {
        listing_id: 'real-estate-office-kazan-01',
        buyer_id: 'agent:unit-test',
        initial_message: 'Здравствуйте! Готов обсудить аренду места на месяц.',
      });

      expect(joinResult.success).toBe(true);
      expect(joinResult.room_id).toBeDefined();
      const roomId = joinResult.room_id;

      // 2. Send message
      const msgResult = await executeMcpToolCall('send_message', {
        room_id: roomId,
        sender: 'agent:counterparty',
        role: 'agent',
        text: 'Приветствую! Мы подтверждаем доступность с понедельника.',
      });

      expect(msgResult.success).toBe(true);
      expect(msgResult.message.text).toContain('подтверждаем');

      // 3. Get room history
      const historyResult = await executeMcpToolCall('get_room_history', {
        room_id: roomId,
      });

      expect(historyResult.room_id).toBe(roomId);
      expect(historyResult.messages.length).toBeGreaterThanOrEqual(2);

      // Verify directly from SQLite
      const roomInDb = getRoomByIdFromDb(roomId);
      expect(roomInDb).toBeDefined();
      expect(roomInDb?.messages.length).toBeGreaterThanOrEqual(2);
    });

    it('get_embedding_status returns current provider status without throwing', async () => {
      const statusResult = await executeMcpToolCall('get_embedding_status', {});
      expect(statusResult).toHaveProperty('provider');
      expect(['google', 'fallback', 'disabled']).toContain(statusResult.provider);
    });

    it('get_profile retrieves existing author profile from SQLite', async () => {
      const profileResult = await executeMcpToolCall('get_profile', {
        profile_id: 'user:founder-alex',
      });

      expect(profileResult.profile).toBeDefined();
      expect(profileResult.profile.id).toBe('user:founder-alex');
      expect(typeof profileResult.profile.name).toBe('string');
    });
  });

  describe('handleMcpJsonRpcRequest (JSON-RPC 2.0 Compliance)', () => {
    it('handles tools/list request', async () => {
      const response = await handleMcpJsonRpcRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
      expect(response.result.tools.length).toBeGreaterThan(5);
    });

    it('handles tools/call request for search_listings', async () => {
      const response = await handleMcpJsonRpcRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'search_listings',
          arguments: {
            category: 'communities',
          },
        },
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(2);
      expect(response.result.content[0].type).toBe('text');
      const parsedData = JSON.parse(response.result.content[0].text);
      expect(parsedData.total_found).toBeGreaterThan(0);
      expect(Array.isArray(parsedData.items)).toBe(true);
    });

    it('returns standard JSON-RPC error for unknown method', async () => {
      const response = await handleMcpJsonRpcRequest({
        jsonrpc: '2.0',
        id: 99,
        method: 'non_existent_method',
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(99);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32601);
    });
  });

  describe('Autonomous Negotiation Idempotency & Conflict Safety', () => {
    it('does not throw UNIQUE constraint failed when room is created twice or pre-prepared', async () => {
      const testRoomId = 'room-conflict-test-' + Date.now();
      // First creation
      const room1 = createRoomInDb({
        id: testRoomId,
        listingTitle: 'Idempotency Test Room',
        participants: ['user:1', 'agent:angel'],
      });
      expect(room1).toBeDefined();

      // Second creation of identical room id (must not throw SQLite UNIQUE constraint error)
      expect(() => {
        const room2 = createRoomInDb({
          id: testRoomId,
          listingTitle: 'Updated Idempotency Test Room',
          participants: ['user:1', 'agent:angel', 'agent:counterpart'],
        });
        expect(room2).toBeDefined();
      }).not.toThrow();
    });
  });
});

