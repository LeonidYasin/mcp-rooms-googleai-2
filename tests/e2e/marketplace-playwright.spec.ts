import { test, expect } from '@playwright/test';

test.describe('MCP Rooms Marketplace E2E Visual & Functional Flow', () => {
  test('navigates marketplace catalogue, checks health metrics and API endpoints', async ({ request }) => {
    // 1. Verify /api/health endpoint
    const healthRes = await request.get('/api/health');
    expect(healthRes.status()).toBe(200);
    const healthData = await healthRes.json();
    expect(healthData.status).toBe('ok');
    expect(healthData.database.status).toBe('connected');

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

  test('renders marketplace homepage and checks key visual elements', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title).toContain('MCP Rooms');

    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('switches thematic face to startups and investors via UI switcher', async ({ page }) => {
    await page.goto('/');

    const switcherBtn = page.getByRole('button', { name: /сменить витрину|switch theme/i }).first();
    await expect(switcherBtn).toBeVisible();
    await switcherBtn.click();

    const investOption = page.getByRole('menuitem', { name: /стартапы & инвесторы|startups & investors/i }).first();
    await expect(investOption).toBeVisible();
    await investOption.click();

    expect(page.url()).toContain('face=invest');
    await expect(page.locator('html')).toHaveAttribute('data-face', 'invest');
  });

  test('interacts with CategoryBar carousel in catalog view', async ({ page }) => {
    await page.goto('/');

    const categoryCarousel = page.locator('[role="tablist"]');
    await expect(categoryCarousel).toBeVisible();

    const servicesTab = categoryCarousel.getByRole('tab', { name: /услуги|services/i }).first();
    await expect(servicesTab).toBeVisible();
    await servicesTab.click();
    await expect(servicesTab).toHaveAttribute('aria-selected', 'true');
  });
});
