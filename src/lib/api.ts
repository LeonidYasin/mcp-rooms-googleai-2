/**
 * Client-side identity handling (PR-4).
 *
 * The key is issued by the operator CLI (`npm run auth -- key issue`), pasted by
 * the user and kept in localStorage. Nothing here invents a key: requests
 * without one are sent without Authorization and the server answers 401.
 *
 * Tokens are never put in a URL. The SSE stream is read with `fetch` so the
 * `Authorization` header works there too.
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
  requiredScope?: string;
}

/** Reads `{error, message, required_scope}` from a failed response without throwing. */
export async function readApiFailure(res: Response): Promise<ApiFailure> {
  let message = `${res.status} ${res.statusText}`;
  let requiredScope: string | undefined;
  try {
    const body = await res.json();
    if (typeof body?.message === 'string') message = body.message;
    else if (typeof body?.error === 'string') message = body.error;
    if (typeof body?.required_scope === 'string') requiredScope = body.required_scope;
  } catch {
    // non-JSON error body
  }
  return { status: res.status, message, requiredScope };
}

export function isUnauthorized(failure: ApiFailure | null | undefined): boolean {
  return failure?.status === 401;
}

export interface Identity {
  user_id: string;
  display_name: string;
  credential_id: string;
  credential_name: string | null;
  scopes: string[];
  expires_at: number;
  resource: string | null;
}

export type IdentityResult =
  | { ok: true; identity: Identity }
  | { ok: false; failure: ApiFailure };

/**
 * Verifies a key against `GET /identity`. The secret is sent only in the
 * Authorization header and is never returned by the server.
 */
export async function fetchIdentity(key?: string): Promise<IdentityResult> {
  const token = (key ?? getStoredApiKey()).trim();
  if (!token) {
    return { ok: false, failure: { status: 401, message: 'Ключ не задан' } };
  }
  try {
    const res = await fetch('/identity', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ok: false, failure: await readApiFailure(res) };
    }
    return { ok: true, identity: (await res.json()) as Identity };
  } catch {
    return { ok: false, failure: { status: 0, message: 'Сервер недоступен' } };
  }
}

export interface SseEvent {
  event: string;
  data: string;
  id: string | null;
}

/**
 * Reads a `text/event-stream` response with fetch so the request can carry an
 * Authorization header. EventSource cannot send headers, and the server
 * rejects tokens in the query string.
 */
export async function streamSse(
  url: string,
  onEvent: (event: SseEvent) => void,
  signal: AbortSignal
): Promise<void> {
  const res = await fetch(url, {
    headers: authHeaders({ Accept: 'text/event-stream' }),
    cache: 'no-store',
    signal,
  });
  if (!res.ok) {
    const failure = await readApiFailure(res);
    throw Object.assign(new Error(failure.message), { failure });
  }
  if (!res.body) throw new Error('Streaming is not supported by this browser.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = 'message';
  let dataLines: string[] = [];
  let lastId: string | null = null;

  const dispatch = () => {
    if (dataLines.length === 0) {
      eventName = 'message';
      return;
    }
    onEvent({ event: eventName || 'message', data: dataLines.join('\n'), id: lastId });
    eventName = 'message';
    dataLines = [];
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        for (const line of block.split('\n')) {
          if (!line || line.startsWith(':')) continue;
          const colon = line.indexOf(':');
          const field = colon === -1 ? line : line.slice(0, colon);
          const rawValue = colon === -1 ? '' : line.slice(colon + 1);
          const valueText = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;

          if (field === 'event') eventName = valueText;
          else if (field === 'data') dataLines.push(valueText);
          else if (field === 'id') lastId = valueText;
          // `retry` is a hint for EventSource; the fetch stream reconnects on its own.
        }

        dispatch();
        boundary = buffer.indexOf('\n\n');
      }
    }
    // A final event without a trailing blank line still counts.
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
      }
      dispatch();
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // already released
    }
  }
}
