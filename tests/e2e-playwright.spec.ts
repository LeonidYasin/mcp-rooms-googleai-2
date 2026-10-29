import { test, expect } from '@playwright/test';

test.describe('MCP Rooms React SPA & Server Headless E2E Scenarios (Issue #30)', () => {

  test('loads home page, renders header title and catalog listings', async ({ page }) => {
    await page.goto('/');

    // Verify main header title and navigation
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByText('MCP Rooms', { exact: false })).toBeVisible();

    // Verify listings heading and SQLite list counter
    await expect(page.getByRole('heading', { name: /Все объявления/i })).toBeVisible();
    await expect(page.getByText(/Найдено в базе данных SQLite/i)).toBeVisible();
  });

  test('navigates between main SPA tabs: Catalog, MCP Console, Principles, and Angel Agent Chat', async ({ page }) => {
    await page.goto('/');

    // 1. Switch to MCP Console
    await page.getByRole('button', { name: /MCP Консоль/i }).click();
    await expect(page.getByRole('heading', { name: /Мониторинг протокола MCP и Переговоры/i })).toBeVisible();

    // 2. Switch to Principles Banner
    await page.getByRole('button', { name: /Принципы/i }).click();
    await expect(page.getByText(/Принципы площадки MCP Rooms/i)).toBeVisible();

    // 3. Switch to Angel Agent Chat
    await page.getByRole('button', { name: /Агент-Ангел/i }).click();
    await expect(page.getByPlaceholder(/Задайте вопрос или поручите задачу/i)).toBeVisible();

    // 4. Return home/catalog
    await page.getByText('MCP Rooms', { exact: false }).first().click();
    await expect(page.getByRole('heading', { name: /Все объявления/i })).toBeVisible();
  });

  test('opens API Key Modal and verifies key configuration prompt', async ({ page }) => {
    await page.goto('/');

    // Click API Key button in header
    const apiKeyButton = page.getByRole('button', { name: /Ключ/i });
    await expect(apiKeyButton).toBeVisible();
    await apiKeyButton.click();

    // Modal should appear
    await expect(page.getByText(/Управление API-ключом доступа/i)).toBeVisible();
    await expect(page.getByPlaceholder(/mcr_/i)).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: '✕' }).click();
    await expect(page.getByText(/Управление API-ключом доступа/i)).not.toBeVisible();
  });

  test('filters listings by offer/request kind', async ({ page }) => {
    await page.goto('/');

    // Click 'Предлагаю' filter
    await page.getByRole('button', { name: /Предлагаю/i }).click();
    await expect(page.getByRole('heading', { name: /Все объявления/i })).toBeVisible();

    // Click 'Ищу' filter
    await page.getByRole('button', { name: /Ищу/i }).click();
    await expect(page.getByRole('heading', { name: /Все объявления/i })).toBeVisible();

    // Reset to 'Все'
    await page.getByRole('button', { name: 'Все', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Все объявления/i })).toBeVisible();
  });

});
