import { Router } from 'express';
import crypto from 'node:crypto';
import { addAuditLog } from '../db';
import { issueApiKey, principalFromRequest } from '../auth';
import { rateLimit } from '../http-guard';

export const authRouter = Router();

authRouter.post('/api/auth/guest', rateLimit('guest_auth', 'RATE_LIMIT_CHAT_PER_MINUTE', 20), (_req, res) => {
  try {
    const slug = 'guest-' + crypto.randomBytes(4).toString('hex');
    const issued = issueApiKey(`user:${slug}`, 'Гостевой аккаунт', ['*']);
    addAuditLog('auth.guest_issue', issued.principalId, issued.id);
    res.status(201).json({
      key: issued.key,
      principalId: issued.principalId,
      name: issued.name,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.get('/api/auth/me', (req, res) => {
  try {
    const principal = principalFromRequest(req);
    if (!principal) {
      res.json({ authenticated: false, principal: null });
      return;
    }
    const isGuest = principal.principalId.startsWith('user:guest-');
    res.json({
      authenticated: true,
      principal: {
        principalId: principal.principalId,
        keyId: principal.keyId,
        scopes: principal.scopes,
        isGuest,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Internal registration endpoint for companion bots (e.g. Civis Telegram Bot).
 * Protected by secret header X-Bot-Secret matching process.env.BOT_SHARED_SECRET.
 * Automatically provisions an isolated principal `user:tg-<tg_id>` and issues a Bearer key.
 */
authRouter.post('/api/bot/register-user', rateLimit('bot_reg', 'RATE_LIMIT_CHAT_PER_MINUTE', 60), (req, res) => {
  try {
    const secretHeader = req.headers['x-bot-secret'];
    const expectedSecret = process.env.BOT_SHARED_SECRET;

    if (!expectedSecret || secretHeader !== expectedSecret) {
      res.status(403).json({ error: 'forbidden', message: 'Неверный или отсутствующий заголовок X-Bot-Secret' });
      return;
    }

    const { tg_id, name } = req.body || {};
    if (!tg_id) {
      res.status(400).json({ error: 'invalid_params', message: 'Параметр tg_id обязателен' });
      return;
    }

    const cleanTgId = String(tg_id).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    if (!cleanTgId) {
      res.status(400).json({ error: 'invalid_params', message: 'Некорректный формат tg_id' });
      return;
    }

    const principalId = `user:tg-${cleanTgId}`;
    const keyName =
      name && typeof name === 'string' && name.trim().length >= 2
        ? `Civis: ${name.trim().substring(0, 100)}`
        : `Civis Citizen ${cleanTgId}`;

    const issued = issueApiKey(principalId, keyName, ['*']);
    addAuditLog('auth.bot_register', issued.principalId, issued.id);
    res.status(201).json({
      success: true,
      key: issued.key,
      principalId: issued.principalId,
      keyId: issued.id,
      name: issued.name,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
