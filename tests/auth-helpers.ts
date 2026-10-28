import { createUserInDb, getUserInDb } from '../server/db';
import { DEFAULT_SCOPES, issueCredential } from '../server/auth';

let issued = 0;

/** Creates the user row the credentials table points at (idempotent per test run). */
export function ensureTestUser(userId = 'user:vitest-runner', displayName = userId): string {
  if (!getUserInDb(userId)) {
    createUserInDb({ id: userId, displayName, createdAt: Date.now() });
  }
  return userId;
}

/** Issues a throwaway credential for tests. The digest is stored; the token is returned. */
export function issueTestKey(
  userId = 'user:vitest-runner',
  options: { scopes?: string[]; days?: number } = {}
): { key: string; id: string } {
  ensureTestUser(userId);
  issued += 1;
  const result = issueCredential({
    userId,
    name: `vitest-${Date.now()}-${issued}`,
    scopes: options.scopes ?? DEFAULT_SCOPES,
    days: options.days,
  });
  return { key: result.key, id: result.credentialId };
}

export function authJson(key: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
}

export function authOnly(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}` };
}
