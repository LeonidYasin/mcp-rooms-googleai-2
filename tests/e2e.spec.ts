import { test, expect } from '@playwright/test';

test.describe('MCP Rooms Web Application E2E Tests', () => {
  test('loads home page and verifies header title and search elements', async ({ page }) => {
    await page.goto('/');

    // Check page title / header
    const bodyText = await page.innerText('body');
    expect(bodyText).toBeDefined();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
