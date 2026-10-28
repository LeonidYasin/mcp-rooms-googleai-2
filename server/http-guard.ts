import type { NextFunction, Request, Response } from 'express';

/**
 * F-13: the HTTP edge had a 10 MB JSON body limit, no security headers, no
 * CORS decision and no request limits. This module implements the minimum that
 * is actually verifiable in CI:
 *
 * - response headers that cannot break the SPA;
 * - an explicit same-origin-by-default CORS policy with an optional allowlist;
 * - an in-process fixed-window rate limiter;
 * - JSON parse errors mapped to 400/413 instead of an HTML stack trace.
 *
 * Deliberately *not* here: a strict `script-src`/`style-src` CSP (the production
 * bundle is not browser-tested in CI, so such a policy would be unverified), a
 * shared rate-limit store (in-process only, see README), and `trust proxy`
 * handling (off by default; behind a reverse proxy every client shares the
 * proxy's socket address unless that is configured deliberately).
 */

export const JSON_BODY_LIMIT = '256kb';

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  // Only directives that do not govern resource loading: safe for the SPA.
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'none'; object-src 'none'");
  next();
}

function allowedOrigins(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isSameOrigin(origin: string, host?: string): boolean {
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * No `Origin` header (curl, MCP clients, server-to-server) → allowed.
 * Same origin → allowed without CORS headers.
 * Allowlisted origin → echoed `Access-Control-Allow-Origin`, preflight handled.
 * Anything else → 403 for preflight and for non-GET requests; GET/HEAD pass
 * without CORS headers, so a browser cannot read the response.
 */
export function corsPolicy(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (!origin) {
    next();
    return;
  }

  const entries = allowedOrigins();
  const sameOrigin = isSameOrigin(origin, req.headers.host);
  const allowlisted = entries.includes('*') || entries.includes(origin);

  if (sameOrigin || allowlisted) {
    if (allowlisted && !sameOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Last-Event-ID');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
    return;
  }

  if (req.method === 'OPTIONS' || (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.status(403).json({ error: 'cors_origin_not_allowed' });
    return;
  }
  next();
}

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_BUCKETS = 5_000;
const buckets = new Map<string, Bucket>();

function configuredLimit(envName: string, fallback: number): number {
  const raw = Number(process.env[envName]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Fixed-window limiter keyed by the authenticated principal, falling back to
 * the socket address. In-process: a second instance or a restart has its own
 * counters.
 */
export function rateLimit(name: string, envName: string, fallbackPerMinute: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const max = configuredLimit(envName, fallbackPerMinute);
    const identity = req.principal?.principalId || req.ip || 'unknown';
    const key = `${name}:${identity}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + WINDOW_MS };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    res.setHeader('X-RateLimit-Limit', String(max));
    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'rate_limited', retryAfterSeconds: retryAfter });
      return;
    }

    res.setHeader('X-RateLimit-Remaining', String(max - bucket.count));
    if (buckets.size > MAX_BUCKETS) sweep(now);
    next();
  };
}

/** Test helper: drops all counters. */
export function resetRateLimits() {
  buckets.clear();
}

export function httpErrorHandler(err: any, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'payload_too_large', limit: JSON_BODY_LIMIT });
    return;
  }
  if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }
  console.error('[http] unhandled error:', err?.stack || err);
  res.status(500).json({ error: 'internal_error' });
}
