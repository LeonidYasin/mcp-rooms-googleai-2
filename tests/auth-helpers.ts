import { issueApiKey, ApiScope } from '../server/auth';

let issued = 0;

/** Issues a throwaway key for tests. The digest is stored; the token is returned. */
export function issueTestKey(
  principalId = 'user:vitest-runner',
  scopesOrName?: string | ApiScope[],
  scopes?: ApiScope[]
): { key: string; id: string } {
  issued += 1;
  let keyScopes: ApiScope[] = ['*'];
  let name = `vitest-${Date.now()}-${issued}`;

  if (Array.isArray(scopesOrName)) {
    keyScopes = scopesOrName;
  } else if (typeof scopesOrName === 'string') {
    name = scopesOrName;
  }
  if (Array.isArray(scopes)) {
    keyScopes = scopes;
  }

  const result = issueApiKey(principalId, name, keyScopes);
  return { key: result.key, id: result.id };
}

export function authJson(key: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
}

export function authOnly(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}` };
}
