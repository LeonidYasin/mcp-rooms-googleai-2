import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import {
  countCredentialsInDb,
  createCredentialInDb,
  getCredentialByIdInDb,
  getUserInDb,
  revokeCredentialInDb,
  touchCredentialInDb,
  type CredentialRecord,
} from './db';

/**
 * Identity contract for the rooms API (PR-4), aligned with the original
 * `mcp-rooms` project (`src/mcp_rooms/identity.py`):
 *
 * - a credential has a public id, scopes, a resource binding, an expiry and a
 *   revocation flag;
 * - only a sha256 digest is persisted, the raw token is printed once;
 * - authentication is checked on every request and fails closed;
 * - storage failures return a sanitized 503, never a fake success or 500 leak.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}

export const ALL_SCOPES = ['rooms:read', 'rooms:write', 'listings:read', 'listings:write'] as const;
export type Scope = (typeof ALL_SCOPES)[number];

/** Default grant for an ordinary participant key. */
export const DEFAULT_SCOPES: Scope[] = ['rooms:read', 'rooms:write', 'listings:read', 'listings:write'];

export const DEFAULT_TTL_DAYS = 7;
export const MAX_TTL_DAYS = 90;
export const MAX_CREDENTIALS_PER_USER = 20;

export const TOKEN_PATTERN = /^mcr_([0-9a-f]{32})\.([A-Za-z0-9_-]{43})$/;
export const PRINCIPAL_PATTERN = /^user:[a-z0-9][a-z0-9._-]{1,63}$/;

export interface Principal {
  userId: string;
  credentialId: string;
  scopes: Set<Scope>;
  expiresAt: number;
}

export class AuthenticationUnavailableError extends Error {
  constructor() {
    super('authentication_unavailable');
    this.name = 'AuthenticationUnavailableError';
  }
}

export function isValidPrincipalId(id: string): boolean {
  return PRINCIPAL_PATTERN.test(id);
}

export function isValidScope(value: string): value is Scope {
  return (ALL_SCOPES as readonly string[]).includes(value);
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

/**
 * The resource this deployment is bound to. Empty means "unbound", which is
 * only acceptable for local development; production must set MCP_RESOURCE to
 * the public https://host/mcp URL (same rule as the original project).
 */
export function resolveResource(): string {
  const raw = (process.env.MCP_RESOURCE || '').trim();
  if (!raw) return '';
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('MCP_RESOURCE must be a valid absolute URL');
  }
  const localHttp =
    parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !localHttp) {
    throw new Error('MCP_RESOURCE must use https (http is allowed only for localhost)');
  }
  if (!parsed.pathname.endsWith('/mcp') || parsed.search || parsed.hash) {
    throw new Error('MCP_RESOURCE must end with /mcp and carry no query or fragment');
  }
  return raw;
}

export interface IssuedCredential {
  key: string;
  credentialId: string;
  userId: string;
  name: string;
  scopes: Scope[];
  expiresAt: number;
  resource: string;
}

function assertScopes(scopes: string[]): Scope[] {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new Error('At least one scope is required.');
  }
  for (const scope of scopes) {
    if (!isValidScope(scope)) {
      throw new Error(`Unknown scope "${scope}". Allowed: ${ALL_SCOPES.join(', ')}.`);
    }
  }
  return Array.from(new Set(scopes)).sort() as Scope[];
}

function assertTtlDays(days: number): number {
  if (!Number.isInteger(days) || days < 1 || days > MAX_TTL_DAYS) {
    throw new Error(`Credential lifetime must be 1..${MAX_TTL_DAYS} days.`);
  }
  return days;
}

function newToken(): { key: string; id: string; digest: string } {
  const id = crypto.randomBytes(16).toString('hex');
  const secret = crypto.randomBytes(32).toString('base64url');
  const key = `mcr_${id}.${secret}`;
  return { key, id, digest: hashToken(key) };
}

/** Issues a credential for an existing, enabled user. Returns the raw key once. */
export function issueCredential(input: {
  userId: string;
  name: string;
  scopes?: string[];
  days?: number;
  resource?: string;
}): IssuedCredential {
  if (!isValidPrincipalId(input.userId)) {
    throw new Error(`Invalid user id "${input.userId}". Expected user:<lowercase-slug>.`);
  }
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) {
    throw new Error('Credential name must be 2..120 characters.');
  }
  const scopes = assertScopes(input.scopes && input.scopes.length > 0 ? input.scopes : DEFAULT_SCOPES);
  const days = assertTtlDays(input.days ?? DEFAULT_TTL_DAYS);
  const resource = input.resource ?? resolveResource();

  const user = getUserInDb(input.userId);
  if (!user) throw new Error(`Unknown user "${input.userId}". Create it first.`);
  if (user.disabled) throw new Error(`User "${input.userId}" is disabled.`);
  if (countCredentialsInDb(input.userId) >= MAX_CREDENTIALS_PER_USER) {
    throw new Error(`User already has ${MAX_CREDENTIALS_PER_USER} credentials (lifetime cap).`);
  }

  const now = Date.now();
  const expiresAt = now + days * 24 * 3600 * 1000;
  const token = newToken();
  createCredentialInDb({
    id: token.id,
    userId: input.userId,
    name,
    digest: token.digest,
    resource,
    scopes,
    createdAt: now,
    expiresAt,
  });

  return {
    key: token.key,
    credentialId: token.id,
    userId: input.userId,
    name,
    scopes,
    expiresAt,
    resource,
  };
}

/**
 * Self-service copy of the current credential: same user, scopes no broader
 * than the source, expiry never later than the source. The old key stays valid.
 */
export function delegateCredential(principal: Principal, days?: number): IssuedCredential {
  const source = getCredentialByIdInDb(principal.credentialId);
  if (!source || source.revokedAt !== null || source.expiresAt <= Date.now()) {
    throw new Error('authentication_required');
  }
  const sourceUser = getUserInDb(source.userId);
  if (!sourceUser || sourceUser.disabled) throw new Error('authentication_required');
  if (countCredentialsInDb(source.userId) >= MAX_CREDENTIALS_PER_USER) {
    throw new Error('credential_capacity');
  }

  const requested = days === undefined ? DEFAULT_TTL_DAYS : assertTtlDays(days);
  const expiresAt = Math.min(Date.now() + requested * 24 * 3600 * 1000, source.expiresAt);
  const token = newToken();
  createCredentialInDb({
    id: token.id,
    userId: source.userId,
    name: `${source.name} (delegated)`,
    digest: token.digest,
    resource: source.resource,
    scopes: source.scopes,
    createdAt: Date.now(),
    expiresAt,
  });

  return {
    key: token.key,
    credentialId: token.id,
    userId: source.userId,
    name: `${source.name} (delegated)`,
    scopes: source.scopes as Scope[],
    expiresAt,
    resource: source.resource,
  };
}

export function revokeCredential(credentialId: string): boolean {
  return revokeCredentialInDb(credentialId, Date.now());
}

/**
 * Resolves a raw bearer token. Returns null for anything unknown, malformed,
 * expired, revoked or disabled. Throws only when storage itself is unavailable.
 */
export function authenticate(raw: string): Principal | null {
  if (typeof raw !== 'string') return null;
  const match = TOKEN_PATTERN.exec(raw);
  if (!match) return null;
  const [, credentialId] = match;

  let record: CredentialRecord | null;
  let user;
  try {
    record = getCredentialByIdInDb(credentialId);
    user = record ? getUserInDb(record.userId) : null;
  } catch {
    throw new AuthenticationUnavailableError();
  }
  if (!record || !user) return null;

  const expected = Buffer.from(record.digest, 'hex');
  const actual = Buffer.from(hashToken(raw), 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

  const now = Date.now();
  if (user.disabled || record.revokedAt !== null || record.expiresAt <= now) return null;

  const configuredResource = resolveResource();
  if (configuredResource && record.resource !== configuredResource) return null;

  const scopes = record.scopes.filter(isValidScope);
  if (scopes.length === 0) return null;

  try {
    touchCredentialInDb(record.id, now);
  } catch {
    // A failed last_used_at write must not turn a valid request into a 503.
  }

  return {
    userId: record.userId,
    credentialId: record.id,
    scopes: new Set(scopes),
    expiresAt: record.expiresAt,
  };
}

export function principalFromAuthorizationHeader(header: string | undefined): Principal | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header.trim());
  if (!match) return null;
  return authenticate(match[1]);
}

/**
 * Query strings are not an authentication channel: the original project rejects
 * them outright. This also removes the temporary `?access_token=` SSE escape.
 */
export function principalFromRequest(req: Request): Principal | null {
  return principalFromAuthorizationHeader(req.headers.authorization);
}

function unauthorized(res: Response) {
  res
    .status(401)
    .set('WWW-Authenticate', 'Bearer realm="mcp-rooms"')
    .json({ error: 'invalid_token' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const principal = principalFromRequest(req);
    if (!principal) {
      unauthorized(res);
      return;
    }
    req.principal = principal;
    next();
  } catch (err) {
    if (err instanceof AuthenticationUnavailableError) {
      res.status(503).json({ error: 'authentication_unavailable' });
      return;
    }
    next(err);
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const principal = principalFromRequest(req);
    if (principal) req.principal = principal;
  } catch {
    // Public routes stay public even if the credential store is unavailable.
  }
  next();
}

export function hasScope(principal: Principal | undefined, scope: Scope): boolean {
  return Boolean(principal && principal.scopes.has(scope));
}

/** 403 with the missing scope, matching the tool-level contract in the original. */
export function requireScope(scope: Scope) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!hasScope(req.principal, scope)) {
      res.status(403).json({ error: 'insufficient_scope', required_scope: scope });
      return;
    }
    next();
  };
}

/** Strict membership check shared by REST, MCP and the SSE stream. */
export function isRoomParticipant(
  room: { participants?: string[] } | null | undefined,
  userId: string | undefined
): boolean {
  if (!room || !userId) return false;
  return Array.isArray(room.participants) && room.participants.includes(userId);
}

/** Rejects any query string on an authenticated JSON endpoint. */
export function rejectQueryString(req: Request, res: Response, next: NextFunction) {
  if (req.originalUrl.includes('?')) {
    res.status(400).json({ error: 'query_not_supported' });
    return;
  }
  next();
}
