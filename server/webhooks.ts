import { db } from './db';
import { logger } from './logger';

export interface WebhookRecord {
  id: string;
  owner: string;
  url: string;
  events: string[];
  secret?: string;
  createdAt: number;
}

export function registerWebhookInDb(hook: {
  id: string;
  owner: string;
  url: string;
  events: string[];
  secret?: string;
}): WebhookRecord {
  const now = Date.now();
  db.prepare(`
    INSERT INTO webhooks (id, owner, url, events_json, secret, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    hook.id,
    hook.owner,
    hook.url,
    JSON.stringify(hook.events || ['*']),
    hook.secret || null,
    now
  );

  return {
    id: hook.id,
    owner: hook.owner,
    url: hook.url,
    events: hook.events || ['*'],
    secret: hook.secret,
    createdAt: now,
  };
}

export function getWebhooksFromDb(owner?: string): WebhookRecord[] {
  let query = 'SELECT * FROM webhooks';
  const params: any[] = [];
  if (owner) {
    query += ' WHERE owner = ?';
    params.push(owner);
  }
  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map((r) => ({
    id: r.id,
    owner: r.owner,
    url: r.url,
    events: JSON.parse(r.events_json || '["*"]'),
    secret: r.secret || undefined,
    createdAt: r.created_at,
  }));
}

export function deleteWebhookFromDb(id: string, owner: string): boolean {
  const result = db.prepare('DELETE FROM webhooks WHERE id = ? AND owner = ?').run(id, owner);
  return result.changes > 0;
}

export async function dispatchWebhookEvent(eventType: string, payload: any) {
  const allHooks = getWebhooksFromDb();
  const matching = allHooks.filter(
    (h) => h.events.includes('*') || h.events.includes(eventType)
  );

  for (const hook of matching) {
    try {
      await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': eventType,
          'X-Webhook-Signature': hook.secret ? `sha256=${hook.secret}` : '',
        },
        body: JSON.stringify({
          event: eventType,
          timestamp: Date.now(),
          data: payload,
        }),
      });
    } catch (err: any) {
      logger.error('Webhook dispatch failed', { url: hook.url, event: eventType, error: err?.message || String(err) });
    }
  }
}
