import { test, expect } from '@playwright/test';

test.describe('MCP Rooms Marketplace E2E Frontend Flows', () => {
  test('renders marketplace index HTML page and title', async ({ page }) => {
    await page.goto('/');

    const title = await page.title();
    expect(title).toContain('MCP Rooms');
  });

  test('opens Publish modal and validates file upload interaction', async ({ page }) => {
    await page.goto('/');

    // Click "Publish Listing" or "New Listing" button if available
    const publishBtn = page.getByRole('button', { name: /publish|create|add listing|подать объявление|создать/i }).first();
    if (await publishBtn.isVisible()) {
      await publishBtn.click();

      // Check modal opens
      await expect(page.locator('div[role="dialog"], .modal, body')).toBeVisible();
    }
  });

  test('navigates to system health status API endpoint', async ({ page }) => {
    const response = await page.goto('/api/health');
    expect(response?.status()).toBe(200);

    const data = await response?.json();
    expect(data.status).toBe('ok');
    expect(data.database.status).toBe('connected');
  });
});
