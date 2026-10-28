import { describe, it, expect, beforeAll } from 'vitest';
import { runAutonomousNegotiation } from '../server/negotiator';
import {
  initDatabase,
  getListingByIdFromDb,
  getListingsFromDb,
  getNegotiationsFromDb,
  getRoomsFromDb,
} from '../server/db';

/**
 * The negotiator is a scripted demo. These tests pin the honesty contract:
 * it may read listings, but it must not write rooms, messages, listings or
 * agreements, and it must never label the result as an agreement.
 */
describe('Negotiation is an explicit demo, not a fabricated agreement', () => {
  beforeAll(() => {
    initDatabase();
  });

  it('returns a demo preview for a real listing without writing anything', async () => {
    const listingId = 'real-estate-office-kazan-01';
    const beforeRooms = getRoomsFromDb().length;
    const beforeNegotiations = getNegotiationsFromDb().length;
    const beforeListings = getListingsFromDb({}).length;

    const result = await runAutonomousNegotiation('Договорись об аренде офиса', listingId, {
      principalId: 'user:demo-test',
    });

    expect(result.demo).toBe(true);
    expect(result.status).toBe('demo_preview');
    expect(result.roomId).toBeNull();
    expect(result.targetListing?.id).toBe(listingId);
    expect(result.demoTerms?.note).toContain('не соглашение');
    expect(result.dialogue).toHaveLength(4);
    expect(result.dialogue.every((turn) => turn.simulated === true)).toBe(true);
    expect(result.summary).toContain('не зафиксировано');
    expect(result.steps.some((step) => step.type === 'demo_script')).toBe(true);

    // No fabricated agreement terms.
    expect(JSON.stringify(result)).not.toContain('safetyConfirmed');
    expect(JSON.stringify(result)).not.toContain('"status":"agreed"');

    // No writes of any kind.
    expect(getRoomsFromDb().length).toBe(beforeRooms);
    expect(getNegotiationsFromDb().length).toBe(beforeNegotiations);
    expect(getListingsFromDb({}).length).toBe(beforeListings);
  });

  it('does not create or publish a listing when the target is missing', async () => {
    const beforeListings = getListingsFromDb({}).length;
    const beforeRooms = getRoomsFromDb().length;
    const beforeNegotiations = getNegotiationsFromDb().length;

    const result = await runAutonomousNegotiation('Найди что-нибудь особенное', 'missing-listing', {
      principalId: 'user:demo-test',
    });

    expect(result.status).toBe('no_match');
    expect(result.demo).toBe(true);
    expect(result.targetListing).toBeNull();
    expect(result.roomId).toBeNull();
    expect(result.dialogue).toEqual([]);
    expect(getListingsFromDb({}).length).toBe(beforeListings);
    expect(getListingsFromDb({}).some((l) => l.id === 'missing-listing')).toBe(false);
    expect(getRoomsFromDb().length).toBe(beforeRooms);
    expect(getNegotiationsFromDb().length).toBe(beforeNegotiations);
  });

  it('finds a real listing when no explicit target is given', async () => {
    const result = await runAutonomousNegotiation('Ищу коворкинг в Казани', undefined, {
      principalId: 'user:demo-test',
    });

    expect(result.demo).toBe(true);
    // A match may legitimately be absent on an empty database; if present it must be real.
    if (result.targetListing) {
      expect(getListingByIdFromDb(result.targetListing.id)).toBeDefined();
    }
  });
});
