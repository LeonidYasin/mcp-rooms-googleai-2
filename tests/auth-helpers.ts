import { issueApiKey } from '../server/auth';

let issued = 0;

/** Issues a throwaway key for tests. The digest is stored; the token is returned. */
export function issueTestKey(principalId = 'user:vitest-runner'): { key: string; id: string } {
  issued += 1;
  const result = issueApiKey(principalId, `vitest-${Date.now()}-${issued}`);
  return { key: result.key, id: result.id };
}

export function authJson(key: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
}

export function authOnly(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}` };
}
