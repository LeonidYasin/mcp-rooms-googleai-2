/**
 * Google OAuth 2.0 Integration for Gemini API via Google Identity Services (GIS).
 */

export interface GoogleUserProfile {
  email?: string;
  name?: string;
  picture?: string;
}

const STORAGE_KEY_TOKEN = 'mcp_google_access_token';
const STORAGE_KEY_EXPIRES = 'mcp_google_token_expires_at';
const STORAGE_KEY_USER = 'mcp_google_user_profile';
const STORAGE_KEY_CLIENT_ID = 'mcp_google_client_id';

// Default / fallback Client ID (can be overridden by environment or UI settings)
export const DEFAULT_GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

export function getStoredGoogleClientId(): string {
  if (typeof window === 'undefined') return DEFAULT_GOOGLE_CLIENT_ID;
  const custom = localStorage.getItem(STORAGE_KEY_CLIENT_ID);
  return custom || DEFAULT_GOOGLE_CLIENT_ID;
}

export function storeGoogleClientId(clientId: string): void {
  if (typeof window === 'undefined') return;
  if (!clientId.trim()) {
    localStorage.removeItem(STORAGE_KEY_CLIENT_ID);
  } else {
    localStorage.setItem(STORAGE_KEY_CLIENT_ID, clientId.trim());
  }
}

export function getStoredGoogleToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  const expiresAt = Number(localStorage.getItem(STORAGE_KEY_EXPIRES) || '0');
  if (!token) return null;
  if (expiresAt > 0 && Date.now() >= expiresAt) {
    // Token expired
    clearGoogleAuth();
    return null;
  }
  return token;
}

export function getStoredGoogleUser(): GoogleUserProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeGoogleAuth(
  accessToken: string,
  expiresInSeconds: number,
  user?: GoogleUserProfile
): void {
  if (typeof window === 'undefined') return;
  const expiresAt = Date.now() + (expiresInSeconds - 60) * 1000; // 60s buffer
  localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
  localStorage.setItem(STORAGE_KEY_EXPIRES, String(expiresAt));
  if (user) {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  }
}

export function clearGoogleAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_EXPIRES);
  localStorage.removeItem(STORAGE_KEY_USER);
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              expires_in?: number;
              error?: string;
              error_description?: string;
            }) => void;
          }): {
            requestAccessToken(overrideConfig?: { prompt?: string }): void;
          };
        };
      };
    };
  }
}

/**
 * Initiates the Google OAuth 2.0 flow using Google Identity Services (GIS).
 * Requests scope for Google Generative Language API.
 */
export async function signInWithGoogle(
  clientIdOverride?: string
): Promise<{ accessToken: string; user?: GoogleUserProfile }> {
  const clientId = clientIdOverride?.trim() || getStoredGoogleClientId();
  if (!clientId) {
    throw new Error('Google Client ID не задан. Укажите Client ID в настройках подключения.');
  }

  // Ensure GIS library is available
  if (!window.google?.accounts?.oauth2) {
    await loadGisScript();
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/generative-language email profile openid',
        callback: async (resp) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
            return;
          }
          if (!resp.access_token) {
            reject(new Error('Не удалось получить Access Token от Google.'));
            return;
          }

          let profile: GoogleUserProfile | undefined;
          try {
            // Optionally fetch user email / name
            const userResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${resp.access_token}` },
            });
            if (userResp.ok) {
              const uData = await userResp.json();
              profile = {
                email: uData.email,
                name: uData.name,
                picture: uData.picture,
              };
            }
          } catch (e) {
            // Non-fatal if userinfo fails
          }

          storeGoogleAuth(resp.access_token, resp.expires_in || 3600, profile);
          resolve({ accessToken: resp.access_token, user: profile });
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(err);
    }
  });
}

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Ошибка загрузки Google Identity Services')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Не удалось загрузить скрипт Google Identity Services'));
    document.head.appendChild(script);
  });
}
