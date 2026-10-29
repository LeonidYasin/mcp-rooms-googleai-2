import { test, expect } from '@playwright/test';

test.describe('MCP Rooms Marketplace E2E Visual & Functional Flow', () => {
  test('navigates marketplace catalogue, checks health metrics and API endpoints', async ({ request }) => {
    // 1. Verify /api/health endpoint
    const healthRes = await request.get('/api/health');
    expect(healthRes.status()).toBe(200);
    const healthData = await healthRes.json();
    expect(healthData.status).toBe('healthy');
    expect(healthData.database.status).toBe('ok');

    // 2. Verify public listings API
    const listingsRes = await request.get('/api/listings');
    expect(listingsRes.status()).toBe(200);
    const listings = await listingsRes.json();
    expect(Array.isArray(listings)).toBe(true);
    expect(listings.length).toBeGreaterThan(0);

    // 3. Verify public profiles API
    const profilesRes = await request.get('/api/profiles');
    expect(profilesRes.status()).toBe(200);
    const profiles = await profilesRes.json();
    expect(Array.isArray(profiles)).toBe(true);
  });
});
