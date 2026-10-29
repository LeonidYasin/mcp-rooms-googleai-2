import { describe, it, expect, beforeEach } from 'vitest';
import { executeMcpToolCall } from '../server/mcp';
import { issueTestKey } from './auth-helpers';
import { getListingsFromDb, getRoomByIdFromDb } from '../server/db';

describe('Multi-Agent Reactive Room Conversations', () => {
  let aliceKey: string;
  let bobKey: string;
  let aliceId: string;
  let bobId: string;

  beforeEach(() => {
    const resAlice = issueTestKey('user:alice-tester');
    aliceKey = resAlice.key;
    aliceId = resAlice.id;

    const resBob = issueTestKey('user:bob-seller');
    bobKey = resBob.key;
    bobId = resBob.id;
  });

  it('automatically triggers counterpart agent response on join_room with initial_message', async () => {
    const listings = getListingsFromDb({});
    expect(listings.length).toBeGreaterThan(0);
    const listing = listings[0];

    const joinRes = await executeMcpToolCall(
      'join_room',
      {
        listing_id: listing.id,
        initial_message: 'Какая итоговая цена по объявлению?',
      },
      { principalId: 'user:alice-tester' }
    );

    expect(joinRes.success).toBe(true);
    expect(joinRes.room_id).toBeDefined();

    const room = getRoomByIdFromDb(joinRes.room_id);
    expect(room).not.toBeNull();
    expect(room!.messages.length).toBeGreaterThanOrEqual(2);

    const firstMsg = room!.messages[0];
    expect(firstMsg.sender).toBe('user:alice-tester');
    expect(firstMsg.text).toContain('цена');

    const agentReply = room!.messages[1];
    expect(agentReply).toBeDefined();
    expect(agentReply.text).toContain('Касательно цены');
  });

  it('generates reactive agent reply on send_message', async () => {
    const listings = getListingsFromDb({});
    const listing = listings[0];

    const joinRes = await executeMcpToolCall(
      'join_room',
      { listing_id: listing.id },
      { principalId: 'user:alice-tester' }
    );

    const sendRes = await executeMcpToolCall(
      'send_message',
      {
        room_id: joinRes.room_id,
        role: 'human',
        text: 'Когда у вас есть свободное время для встречи?',
      },
      { principalId: 'user:alice-tester' }
    );

    expect(sendRes.success).toBe(true);

    const room = getRoomByIdFromDb(joinRes.room_id);
    expect(room!.messages.length).toBeGreaterThanOrEqual(2);

    const latestMsg = room!.messages[room!.messages.length - 1];
    expect(latestMsg.role).toBe('agent');
    expect(latestMsg.text).toContain('По графику: готовы организовать встречу');
  });
});
