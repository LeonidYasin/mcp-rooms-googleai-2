/**
 * Client-side API key handling (PR-3).
 *
 * The key is issued on the server with `npm run key:issue`, pasted by the user
 * and kept in localStorage. Nothing here invents a key: requests without one
 * are sent without Authorization and the server answers 401.
 */

const STORAGE_KEY = 'mcp-rooms.api-key';

export function getStoredApiKey(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function storeApiKey(key: string | null): void {
  try {
    if (key && key.trim()) {
      window.localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage can be unavailable (private mode); the key just won't persist.
  }
}

/** Headers for a protected request; adds Bearer only when a key is stored. */
export function authHeaders(base: Record<string, string> = {}): Record<string, string> {
  const key = getStoredApiKey();
  return key ? { ...base, Authorization: `Bearer ${key}` } : { ...base };
}

export interface ApiFailure {
  status: number;
  message: string;
}

/** Reads `{error, message}` from a failed response without throwing. */
export async function readApiFailure(res: Response): Promise<ApiFailure> {
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = await res.json();
    if (typeof body?.message === 'string') message = body.message;
    else if (typeof body?.error === 'string') message = body.error;
  } catch {
    // non-JSON error body
  }
  return { status: res.status, message };
}

export function isUnauthorized(failure: ApiFailure | null | undefined): boolean {
  return failure?.status === 401;
}

/** Requests a fresh, isolated guest key from the server in 1 click. */
export async function createGuestSession(): Promise<{ key: string; principalId: string }> {
  const res = await fetch('/api/auth/guest', { method: 'POST' });
  if (!res.ok) {
    throw new Error('Не удалось получить гостевой доступ');
  }
  const data = await res.json();
  storeApiKey(data.key);
  return data;
}

export interface EmbeddingStatusResponse {
  provider: 'google' | 'disabled' | 'fallback';
  model: string;
  isAvailable: boolean;
  reason?: string;
  hasCustomKey?: boolean;
  keyMasked?: string;
  isConfiguredViaWeb?: boolean;
}

export async function getEmbeddingStatus(): Promise<EmbeddingStatusResponse> {
  const res = await fetch('/api/embedding/status');
  if (!res.ok) {
    throw new Error('Failed to fetch embedding status');
  }
  return res.json();
}

export async function configureEmbeddingKey(apiKey?: string): Promise<{
  success: boolean;
  message: string;
  status: EmbeddingStatusResponse;
}> {
  const res = await fetch('/api/embedding/configure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ apiKey }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || data?.error || 'Failed to configure embedding key');
  }
  return data;
}

export async function triggerEmbeddingReindex(force: boolean = false): Promise<{
  success: boolean;
  total: number;
  indexed: number;
  skipped: number;
  errors: number;
  status: EmbeddingStatusResponse;
}> {
  const res = await fetch('/api/embedding/reindex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ force }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || data?.error || 'Failed to reindex embeddings');
  }
  return data;
}

export interface CurrentAuthMeResponse {
  authenticated: boolean;
  principal: {
    principalId: string;
    keyId: string;
    scopes: string[];
    isGuest: boolean;
  } | null;
}

export async function getCurrentAuthStatus(): Promise<CurrentAuthMeResponse> {
  const key = getStoredApiKey();
  if (!key) {
    return { authenticated: false, principal: null };
  }
  try {
    const res = await fetch('/api/auth/me', {
      headers: authHeaders(),
    });
    if (!res.ok) {
      return { authenticated: false, principal: null };
    }
    return res.json();
  } catch {
    return { authenticated: false, principal: null };
  }
}
