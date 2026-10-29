import { describe, it, expect } from 'vitest';
import { addAuditLog, getAuditLogs } from '../server/db';

describe('Audit Logs & Event Observability', () => {
  it('records and retrieves audit logs', () => {
    const actor = 'user:audit-tester-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const log1 = addAuditLog('listing.create', actor, 'listing-101', { title: 'Test Listing' });
    expect(log1.id).toBeDefined();
    expect(log1.eventType).toBe('listing.create');

    const logs = getAuditLogs({ actorId: actor });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actorId).toBe(actor);
    expect(logs[0].resourceId).toBe('listing-101');
    expect(logs[0].details?.title).toBe('Test Listing');
  });

  it('filters audit logs by eventType', () => {
    const actor = 'user:audit-tester-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    addAuditLog('room.send_message', actor, 'room-1', { text: 'Hello' });
    addAuditLog('auth.forbidden_scope', actor, undefined, { requiredScope: 'admin' });

    const forbiddenLogs = getAuditLogs({ actorId: actor, eventType: 'auth.forbidden_scope' });
    expect(forbiddenLogs.length).toBe(1);
    expect(forbiddenLogs[0].eventType).toBe('auth.forbidden_scope');
    expect(forbiddenLogs[0].details?.requiredScope).toBe('admin');
  });
});
