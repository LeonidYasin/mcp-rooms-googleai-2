import { describe, it, expect, beforeEach } from 'vitest';
import { checkAndConsumeRateLimit, clearRateLimitHits } from '../server/db';

describe('Persistent SQLite Rate Limiter', () => {
  beforeEach(() => {
    clearRateLimitHits();
  });

  it('allows requests within the limit and decrements remaining', () => {
    const key = 'test-key-1';
    const limit = 3;

    const r1 = checkAndConsumeRateLimit(key, limit, 60000);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkAndConsumeRateLimit(key, limit, 60000);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkAndConsumeRateLimit(key, limit, 60000);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    const r4 = checkAndConsumeRateLimit(key, limit, 60000);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets hits when window expires', () => {
    const key = 'test-key-2';
    const limit = 1;

    const r1 = checkAndConsumeRateLimit(key, limit, -100); // window already expired
    expect(r1.allowed).toBe(true);

    const r2 = checkAndConsumeRateLimit(key, limit, 60000);
    expect(r2.allowed).toBe(true);
  });
});
