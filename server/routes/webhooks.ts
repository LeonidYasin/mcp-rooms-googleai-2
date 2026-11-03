import { Router } from 'express';
import {
  getWebhooksFromDb,
  getWebhookByIdFromDb,
  saveWebhookInDb,
  deleteWebhookFromDb,
  addAuditLog,
} from '../db';
import { requireAuth } from '../auth';
import { rateLimit } from '../http-guard';
import { generateWebhookSecret, deliverWebhook } from '../webhooks';

export const webhooksRouter = Router();

webhooksRouter.get('/api/webhooks', requireAuth, (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const webhooks = getWebhooksFromDb(principalId);
    // Mask secrets on listing
    const sanitized = webhooks.map((wh) => ({
      ...wh,
      secret: wh.secret.slice(0, 10) + '...',
    }));
    res.json(sanitized);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

webhooksRouter.post('/api/webhooks', requireAuth, rateLimit('webhooks', 'RATE_LIMIT_WEBHOOKS_PER_MINUTE', 30), (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const { target_url, targetUrl, events, secret } = req.body || {};
    const url = target_url || targetUrl;

    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      res.status(400).json({ error: 'invalid_url', message: 'target_url must be a valid http/https URL' });
      return;
    }

    const webhookId = 'wh-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const assignedSecret = typeof secret === 'string' && secret.trim()
      ? secret.trim()
      : generateWebhookSecret();

    const created = saveWebhookInDb({
      id: webhookId,
      agentId: principalId,
      targetUrl: url.trim(),
      secret: assignedSecret,
      events: Array.isArray(events) && events.length > 0 ? events : ['*'],
      status: 'active',
    });

    addAuditLog('webhook.create', principalId, created.id, {
      targetUrl: created.targetUrl,
      events: created.events,
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

webhooksRouter.delete('/api/webhooks/:id', requireAuth, (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const id = String(req.params.id);
    const existing = getWebhookByIdFromDb(id);
    if (!existing || existing.agentId !== principalId) {
      res.status(404).json({ error: 'webhook_not_found', message: 'Webhook not found' });
      return;
    }

    deleteWebhookFromDb(id, principalId);
    addAuditLog('webhook.delete', principalId, id, { targetUrl: existing.targetUrl });
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

webhooksRouter.post('/api/webhooks/:id/test', requireAuth, async (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const id = String(req.params.id);
    const webhook = getWebhookByIdFromDb(id);
    if (!webhook || webhook.agentId !== principalId) {
      res.status(404).json({ error: 'webhook_not_found', message: 'Webhook not found' });
      return;
    }

    const result = await deliverWebhook(webhook, 'ping', {
      type: 'test_ping',
      sender: principalId,
      timestamp: Date.now(),
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
