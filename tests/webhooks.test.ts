import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase } from '../server/db';
import { registerWebhookInDb, getWebhooksFromDb, deleteWebhookFromDb } from '../server/webhooks';

describe('Async Webhooks Subsystem', () => {
  beforeEach(() => {
    initDatabase();
  });

  it('registers, retrieves, and deletes webhooks from SQLite', () => {
    const owner = 'user:webhook-owner';
    const hookId = 'wh-test-1';

    const registered = registerWebhookInDb({
      id: hookId,
      owner,
      url: 'https://example.com/webhook',
      events: ['room.message', 'listing.created'],
      secret: 'secret-token-123',
    });

    expect(registered.id).toBe(hookId);
    expect(registered.owner).toBe(owner);

    const hooks = getWebhooksFromDb(owner);
    expect(hooks.length).toBeGreaterThanOrEqual(1);
    expect(hooks.some((h) => h.id === hookId)).toBe(true);

    const deleted = deleteWebhookFromDb(hookId, owner);
    expect(deleted).toBe(true);

    const remainingHooks = getWebhooksFromDb(owner);
    expect(remainingHooks.some((h) => h.id === hookId)).toBe(false);
  });
});
