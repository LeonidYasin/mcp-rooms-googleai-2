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
