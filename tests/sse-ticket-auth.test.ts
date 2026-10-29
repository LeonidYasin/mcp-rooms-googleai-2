import { describe, it, expect, beforeEach } from 'vitest';
import { issueTestKey } from './auth-helpers';
import { getRoomsFromDb } from '../server/db';
import { issueSseTicket, consumeSseTicket, Principal } from '../server/auth';

describe('Ticket-based SSE Stream Authentication API', () => {
  let userKey: string;
  let principalId = 'user:sse-tester';

  beforeEach(() => {
    const res = issueTestKey(principalId);
    userKey = res.key;
  });

  it('issues a single-use SSE ticket for a room', () => {
    const rooms = getRoomsFromDb();
    const room = rooms[0];

    const mockPrincipal: Principal = { principalId, keyId: 'key-1', scopes: ['*'] };
    const ticket = issueSseTicket(mockPrincipal, room.id);

    expect(ticket).toBeDefined();
    expect(ticket).toContain('ticket_');

    // Consuming ticket first time succeeds
    const p1 = consumeSseTicket(ticket, room.id);
    expect(p1).not.toBeNull();
    expect(p1!.principalId).toBe(principalId);

    // Consuming ticket second time fails (single-use)
    const p2 = consumeSseTicket(ticket, room.id);
    expect(p2).toBeNull();
  });

  it('rejects expired or invalid SSE tickets', () => {
    const mockPrincipal: Principal = { principalId, keyId: 'key-1', scopes: ['*'] };
    const expiredTicket = issueSseTicket(mockPrincipal, 'room-x', -100); // Expired TTL

    const result = consumeSseTicket(expiredTicket, 'room-x');
    expect(result).toBeNull();
  });
});
