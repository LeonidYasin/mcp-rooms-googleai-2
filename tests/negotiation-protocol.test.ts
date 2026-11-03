import { describe, it, expect, beforeAll } from 'vitest';
import { executeMcpToolCall } from '../server/mcp';
import {
  initDatabase,
  getRoomsFromDb,
  getRoomByIdFromDb,
  getNegotiationsFromDb,
  getNegotiationByIdFromDb,
  createListingInDb,
  db,
} from '../server/db';

describe('TASK-08: Multi-Agent Real Negotiation Protocol', () => {
  const alice = { principalId: 'user:proto-alice' };
  const bob = { principalId: 'user:proto-bob' };
  let testListingId = '';

  beforeAll(() => {
    initDatabase();

    // Create a real published listing authored by Bob
    testListingId = 'listing-proto-test-' + Date.now();
    createListingInDb({
      id: testListingId,
      owner: bob.principalId,
      author_name: 'Bob Developer',
      status: 'published',
      visibility: 'public',
      content: {
        title: 'Разработка интеграции MCP для AI-агентов',
        description: 'Создание кастомных серверов MCP JSON-RPC на TypeScript для подключения к Claude Desktop и Cursor.',
        category: 'services',
        kind: 'offer',
        locality: 'Казань',
        price_minor: 2500000,
        modes: ['online'],
      },
    });
  });

  describe('Mode Preview (Honesty Contract)', () => {
    it('returns demo script preview without creating rooms or DB records when mode is preview', async () => {
      const beforeRooms = getRoomsFromDb().length;
      const beforeNegs = getNegotiationsFromDb().length;

      const result = await executeMcpToolCall(
        'negotiate_agreement',
        {
          goal: 'Договорись о разработке интеграции MCP',
          target_listing_id: testListingId,
          mode: 'preview',
        },
        alice
      );

      expect(result.demo).toBe(true);
      expect(result.status).toBe('demo_preview');
      expect(result.room_id).toBeNull();
      expect(result.demo_terms).toBeDefined();
      expect(result.demo_terms.note).toContain('не соглашение');

      // Database remains unchanged
      expect(getRoomsFromDb().length).toBe(beforeRooms);
      expect(getNegotiationsFromDb().length).toBe(beforeNegs);
    });
  });

  describe('Mode Live (Real Protocol Execution)', () => {
    it('creates an isolated private room, exchanges structured terms, and persists agreement in SQLite', async () => {
      const beforeRooms = getRoomsFromDb().length;

      const result = await executeMcpToolCall(
        'negotiate_agreement',
        {
          goal: 'Хочу заказать разработку MCP сервера для Claude Desktop',
          target_listing_id: testListingId,
          mode: 'live',
          proposed_terms: {
            price: '25000 ₽',
            schedule: '5 рабочих дней',
            location: 'Онлайн',
            guarantees: 'Гарантия 30 дней и фиксация в реестре сделки',
            sla: 'Ответ в течение 4 часов',
          },
        },
        alice
      );

      expect(result.success).toBe(true);
      expect(result.demo).toBe(false);
      expect(result.status).toBe('agreed');
      expect(result.room_id).toBeDefined();
      expect(result.room_id).toContain(testListingId);
      expect(result.negotiation_id).toBeDefined();
      expect(result.rounds_count).toBeGreaterThanOrEqual(2);
      expect(result.agreed_terms).toBeDefined();
      expect(result.agreed_terms.price).toBe('25000 ₽');
      expect(result.agreed_terms.schedule).toBe('5 рабочих дней');
      expect(result.agreed_terms.mutual_consent).toBe(true);

      // Verify Room in SQLite
      const room = getRoomByIdFromDb(result.room_id);
      expect(room).toBeDefined();
      expect(room?.visibility).toBe('private');
      expect(room?.participants).toContain(alice.principalId);
      expect(room?.participants).toContain(bob.principalId);
      expect(room?.messages.length).toBeGreaterThanOrEqual(3);

      // Verify Negotiation Record in SQLite
      const negotiation = getNegotiationByIdFromDb(result.negotiation_id);
      expect(negotiation).toBeDefined();
      expect(negotiation?.roomId).toBe(result.room_id);
      expect(negotiation?.listingId).toBe(testListingId);
      expect(negotiation?.initiatorAgent).toBe(alice.principalId);
      expect(negotiation?.counterpartAgent).toBe(bob.principalId);
      expect(negotiation?.status).toBe('agreed');
      expect(negotiation?.agreedTerms?.mutual_consent).toBe(true);
      expect(negotiation?.rounds.length).toBeGreaterThanOrEqual(2);

      // Verify Audit Log
      const auditRows = db.prepare('SELECT * FROM audit_logs WHERE action = ? AND target_id = ?').all(
        'negotiation.agreement',
        result.negotiation_id
      ) as any[];
      expect(auditRows.length).toBeGreaterThan(0);
      expect(auditRows[0].actor).toBe(alice.principalId);

      // Verify room count incremented by exactly 1
      expect(getRoomsFromDb().length).toBe(beforeRooms + 1);
    });

    it('idempotently handles repeated negotiation calls without creating duplicate rooms', async () => {
      const beforeRooms = getRoomsFromDb().length;
      const beforeNegs = getNegotiationsFromDb().length;

      // Call negotiate_agreement second time with same target listing and principal
      const result2 = await executeMcpToolCall(
        'negotiate_agreement',
        {
          goal: 'Повторный запрос условий по MCP интеграции',
          target_listing_id: testListingId,
          mode: 'live',
        },
        alice
      );

      expect(result2.success).toBe(true);
      expect(result2.demo).toBe(false);
      expect(result2.status).toBe('agreed');

      // No duplicate rooms or negotiations created
      expect(getRoomsFromDb().length).toBe(beforeRooms);
      expect(getNegotiationsFromDb().length).toBe(beforeNegs);
    });

    it('rejects self-negotiation when the caller is the author of the listing', async () => {
      const result = await executeMcpToolCall(
        'negotiate_agreement',
        {
          goal: 'Пытаюсь договориться сам с собой',
          target_listing_id: testListingId,
          mode: 'live',
        },
        bob // Bob is the author of testListingId
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe('declined');
      expect(result.room_id).toBeNull();
      expect(result.summary).toContain('собственному объявлению');
    });

    it('returns no_match when no relevant listing exists', async () => {
      const result = await executeMcpToolCall(
        'negotiate_agreement',
        {
          goal: 'Несуществующий запрос ' + Date.now(),
          target_listing_id: 'missing-listing-id-' + Date.now(),
          mode: 'live',
        },
        alice
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe('no_match');
      expect(result.room_id).toBeNull();
    });
  });

  describe('Autonomous Asymmetric Match + Live Negotiation', () => {
    it('automatically finds best matching listing and enters real negotiation when target_listing_id is omitted', async () => {
      const charlie = { principalId: 'user:proto-charlie' };

      const result = await executeMcpToolCall(
        'negotiate_agreement',
        {
          goal: 'Ищу специалиста по разработке MCP серверов в Казани',
          mode: 'live',
        },
        charlie
      );

      expect(result.success).toBe(true);
      expect(result.demo).toBe(false);
      expect(result.status).toBe('agreed');
      expect(result.room_id).toBeDefined();
      expect(result.target_listing).toBeDefined();
      expect(result.target_listing.id).toBe(testListingId);

      const room = getRoomByIdFromDb(result.room_id);
      expect(room?.participants).toContain(charlie.principalId);
      expect(room?.participants).toContain(bob.principalId);
    });
  });
});
