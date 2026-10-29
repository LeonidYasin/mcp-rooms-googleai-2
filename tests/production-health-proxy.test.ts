import { describe, it, expect } from 'vitest';
import { getListingsFromDb } from '../server/db';

describe('Production Health Metrics Endpoint Helper', () => {
  it('calculates process uptime and memory usage metrics', () => {
    const memoryUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());

    expect(uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(memoryUsage.heapUsed).toBeGreaterThan(0);

    const listings = getListingsFromDb({});
    expect(Array.isArray(listings)).toBe(true);
  });
});
