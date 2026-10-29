import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { issueApiKey, hasScope, Principal } from '../server/auth';
import { revokeApiKeyInDb } from '../server/db';

describe('RBAC Scopes for API Keys', () => {
  let fullKeyId: string;
  let readOnlyKeyId: string;

  beforeEach(() => {
    const fullRes = issueApiKey('user:full-access', 'full', ['*']);
    fullKeyId = fullRes.id;

    const readRes = issueApiKey('user:read-only', 'read', ['listings:read', 'rooms:read']);
    readOnlyKeyId = readRes.id;
  });

  afterEach(() => {
    revokeApiKeyInDb(fullKeyId);
    revokeApiKeyInDb(readOnlyKeyId);
  });

  it('correctly validates scopes for full access principal', () => {
    const fullPrincipal: Principal = {
      principalId: 'user:full-access',
      keyId: fullKeyId,
      scopes: ['*'],
    };

    expect(hasScope(fullPrincipal, 'listings:read')).toBe(true);
    expect(hasScope(fullPrincipal, 'listings:write')).toBe(true);
    expect(hasScope(fullPrincipal, 'rooms:write')).toBe(true);
  });

  it('restricts write operations for read-only principal', () => {
    const readPrincipal: Principal = {
      principalId: 'user:read-only',
      keyId: readOnlyKeyId,
      scopes: ['listings:read', 'rooms:read'],
    };

    expect(hasScope(readPrincipal, 'listings:read')).toBe(true);
    expect(hasScope(readPrincipal, 'rooms:read')).toBe(true);
    expect(hasScope(readPrincipal, 'listings:write')).toBe(false);
    expect(hasScope(readPrincipal, 'rooms:write')).toBe(false);
  });
});
