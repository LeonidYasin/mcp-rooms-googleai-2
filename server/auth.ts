import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import {
  addAuditLog,
  createApiKeyInDb,
  getApiKeyByDigestInDb,
  touchApiKeyInDb,
} from './db';

/**
 * Authentication for the rooms API (PR-3 + RBAC Scopes).
 *
 * A principal is a stable string id such as `user:buy-laptop` or `agent:shopper-1`.
 * Each key belongs to exactly one principal and is shown once, when issued by
 * `npm run key:issue`. Only a sha256 digest is stored, so a database leak does
 * not leak usable tokens.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}

export type ApiScope =
  | 'listings:read'
  | 'listings:write'
  | 'rooms:read'
  | 'rooms:write'
  | 'chat:write'
  | 'admin'
  | '*';

export interface Principal {
  principalId: string;
  keyId: string;
  scopes: ApiScope[];
}

export const KEY_PREFIX = 'mcr_';
/** user:… / agent:… / org:…; lowercase namespace, then a safe slug. */
export const PRINCIPAL_PATTERN = /^(user|agent|org):[a-z0-9][a-z0-9._-]{1,63}$/;

export function isValidPrincipalId(id: string): boolean {
  return PRINCIPAL_PATTERN.test(id);
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key, 'utf8').digest('hex');
}

export interface IssuedApiKey {
  id: string;
  key: string;
  principalId: string;
  name: string;
  scopes: ApiScope[];
}

/**
 * Creates a key and returns the plaintext token exactly once. Throws on an
 * invalid principal id so a typo cannot silently create an unusable identity.
 */
export function issueApiKey(principalId: string, name: string, scopes: ApiScope[] = ['*']): IssuedApiKey {
  if (!isValidPrincipalId(principalId)) {
    throw new Error(
      `Invalid principal id "${principalId}". Expected user:<slug>, agent:<slug> or org:<slug> using lowercase letters, digits, dot, dash or underscore.`
    );
  }
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 120) {
    throw new Error('Key name must be 2..120 characters.');
  }

  const key = KEY_PREFIX + crypto.randomBytes(32).toString('base64url');
  const id = 'key_' + crypto.randomBytes(8).toString('hex');
  const record = createApiKeyInDb({
    id,
    principalId,
    name: trimmedName,
    digest: hashApiKey(key),
    createdAt: Date.now(),
    scopes: scopes.join(','),
  });

  return { id: record.id, key, principalId: record.principalId, name: record.name, scopes };
}

/** Resolves `Authorization: Bearer <token>` to a principal, or null. */
export function principalFromAuthorizationHeader(header: string | undefined): Principal | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header.trim());
  if (!match) return null;

  const record = getApiKeyByDigestInDb(hashApiKey(match[1]));
  if (!record || record.revokedAt !== null) return null;

  touchApiKeyInDb(record.id, Date.now());
  const scopes: ApiScope[] = record.scopes
    ? (record.scopes.split(',') as ApiScope[])
    : ['*'];

  return { principalId: record.principalId, keyId: record.id, scopes };
}

export function hasScope(principal: Principal | undefined, requiredScope: ApiScope): boolean {
  if (!principal) return false;
  if (principal.scopes.includes('*') || principal.scopes.includes('admin')) return true;
  return principal.scopes.includes(requiredScope);
}

/**
 * SSE cannot carry an Authorization header from EventSource, so the stream
 * endpoint accepts `?access_token=`. That is a deliberate, narrow exception:
 * tokens in URLs can end up in proxy logs, so the SSE transport is replaced in
 * PR-8 and this fallback is removed then.
 */
export function principalFromRequest(req: Request): Principal | null {
  const header = principalFromAuthorizationHeader(req.headers.authorization);
  if (header) return header;

  const queryToken = typeof req.query?.access_token === 'string' ? req.query.access_token : undefined;
  if (queryToken) {
    return principalFromAuthorizationHeader(`Bearer ${queryToken}`);
  }
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const principal = principalFromRequest(req);
  if (!principal) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Требуется API-ключ: Authorization: Bearer <token>. Ключ выдаётся командой npm run key:issue.',
    });
    return;
  }
  req.principal = principal;
  next();
}

export function requireScope(requiredScope: ApiScope) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.principal) {
      res.status(401).json({ error: 'unauthorized', message: 'Требуется авторизация.' });
      return;
    }
    if (!hasScope(req.principal, requiredScope)) {
      addAuditLog('auth.forbidden_scope', req.principal.principalId, undefined, { requiredScope });
      res.status(403).json({
        error: 'forbidden_scope',
        message: `Недостаточно прав. Требуется scope: ${requiredScope}`,
      });
      return;
    }
    next();
  };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const principal = principalFromRequest(req);
  if (principal) req.principal = principal;
  next();
}

/** Strict membership check shared by REST, MCP and the SSE stream. */
export function isRoomParticipant(
  room: { participants?: string[] } | null | undefined,
  principalId: string | undefined
): boolean {
  if (!room || !principalId) return false;
  return Array.isArray(room.participants) && room.participants.includes(principalId);
}
