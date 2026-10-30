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

/**
 * EventSource cannot send headers, so the SSE endpoint accepts the token as a
 * query parameter. Temporary: the stream transport is replaced in PR-8.
 */
export function withAccessToken(url: string): string {
  const key = getStoredApiKey();
  if (!key) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}access_token=${encodeURIComponent(key)}`;
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
