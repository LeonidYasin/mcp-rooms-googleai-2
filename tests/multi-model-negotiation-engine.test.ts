import { describe, it, expect, beforeAll } from 'vitest';
import { configuredProvider, configuredModel } from '../server/llm';
import { generateMultiModelNegotiationTurn } from '../server/negotiator';
import { initDatabase, createRoomInDb, createListingInDb } from '../server/db';

describe('Multi-Model Negotiation Engine Support (Issue #32)', () => {
  beforeAll(() => {
    initDatabase();
  });

  it('detects active provider configuration correctly', () => {
    const originalProvider = process.env.LLM_PROVIDER;

    process.env.LLM_PROVIDER = 'openai';
    expect(configuredProvider()).toBe('openai');
    expect(configuredModel()).toBe('gpt-4o-mini');

    process.env.LLM_PROVIDER = 'claude';
    expect(configuredProvider()).toBe('claude');
    expect(configuredModel()).toBe('claude-3-5-sonnet');

    process.env.LLM_PROVIDER = 'mock';
    expect(configuredProvider()).toBe('mock');
    expect(configuredModel()).toBe('mock-rules-engine');

    process.env.LLM_PROVIDER = originalProvider || '';
  });

  it('generates multi-model reactive negotiation turns for room participants', async () => {
    const run = Date.now().toString(36);
    const ownerId = `user:multi-owner-${run}`;
    const buyerId = `user:multi-buyer-${run}`;
    const listingId = `listing-multi-${run}`;
    const roomId = `room-multi-${run}`;

    createListingInDb({
      id: listingId,
      owner: ownerId,
      author_name: 'Multi Model Owner',
      content: {
        title: 'Multi-Model Negotiation Test Listing',
        description: 'Test description',
        category: 'business',
        kind: 'offer',
        locality: 'Казань',
        price_minor: 500000,
        currency: 'RUB',
        modes: ['online'],
      },
      status: 'active',
      visibility: 'public',
      revision: 1,
    });

    createRoomInDb({
      id: roomId,
      listingId,
      listingTitle: 'Multi-Model Negotiation Test Listing',
      participants: [ownerId, buyerId],
    });

    // Test turn with OpenAI provider
    const openAiMsg = await generateMultiModelNegotiationTurn(roomId, buyerId, 'Какая цена?', {
      provider: 'openai',
    });
    expect(openAiMsg).not.toBeNull();
    expect(openAiMsg.text).toContain('[OPENAI]');
    expect(openAiMsg.text).toContain('5000 ₽');

    // Test turn with Claude provider
    const claudeMsg = await generateMultiModelNegotiationTurn(roomId, buyerId, 'Когда можно обсудить?', {
      provider: 'claude',
    });
    expect(claudeMsg).not.toBeNull();
    expect(claudeMsg.text).toContain('[CLAUDE]');
    expect(claudeMsg.text).toContain('готовы организовать встречу');
  });
});
