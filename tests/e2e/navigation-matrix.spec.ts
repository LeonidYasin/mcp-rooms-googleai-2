import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('MCP Rooms Complete Button & Navigation Matrix (with Screenshots)', () => {
  const screenshotsDir = path.join(process.cwd(), 'tests', 'e2e', 'screenshots');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('walks through all buttons, tabs, skins, and modals, capturing visual proof at each step', async ({ page }) => {
    // Set a consistent high-res viewport
    await page.setViewportSize({ width: 1280, height: 900 });

    // Step 01: Load Homepage Catalog
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '01_home_catalog.png') });

    // Step 02: Switch Face to Dark Glass (V2 Mockup)
    const faceSwitcher = page.getByRole('button', { name: /сменить витрину|switch theme/i }).first();
    await expect(faceSwitcher).toBeVisible();
    await faceSwitcher.click();
    const darkGlassOption = page.getByRole('menuitem', { name: /dark glass/i }).first();
    if (await darkGlassOption.isVisible()) {
      await darkGlassOption.click();
      await expect(page.locator('html')).toHaveAttribute('data-face', 'dark_glass');
      await page.screenshot({ path: path.join(screenshotsDir, '02_skin_dark_glass.png') });
    }

    // Step 03: Switch Face to Ozon Market
    await faceSwitcher.click();
    const ozonOption = page.getByRole('menuitem', { name: /ozon/i }).first();
    if (await ozonOption.isVisible()) {
      await ozonOption.click();
      await expect(page.locator('html')).toHaveAttribute('data-face', 'ozon_market');
      await page.screenshot({ path: path.join(screenshotsDir, '03_skin_ozon.png') });
    }

    // Step 04: Switch Face to Yandex Realty
    await faceSwitcher.click();
    const yandexOption = page.getByRole('menuitem', { name: /яндекс недвижимость|yandex realty/i }).first();
    if (await yandexOption.isVisible()) {
      await yandexOption.click();
      await expect(page.locator('html')).toHaveAttribute('data-face', 'yandex_realty');
      await page.screenshot({ path: path.join(screenshotsDir, '04_skin_yandex.png') });
    }

    // Step 05: Reset back to General Face via Reset button
    const resetFaceBtn = page.getByRole('button', { name: /все темы|all/i }).first();
    if (await resetFaceBtn.isVisible()) {
      await resetFaceBtn.click();
      await expect(page.locator('html')).not.toHaveAttribute('data-face');
      await page.screenshot({ path: path.join(screenshotsDir, '05_skin_reset_general.png') });
    }

    // Step 06: Search & Advanced Filters Modal
    const filtersBtn = page.getByRole('button', { name: /фильтры|filters/i }).first();
    await expect(filtersBtn).toBeVisible();
    await filtersBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, '06_advanced_search_modal.png') });

    // Close Advanced Filters Modal (Escape or Close Button)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Step 07: Category Selection in CategoryBar
    const servicesTab = page.getByRole('tab', { name: /услуги|services/i }).first();
    if (await servicesTab.isVisible()) {
      await servicesTab.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(screenshotsDir, '07_category_services.png') });
    }

    // Step 08: Connection Status / API Key Modal
    const apiKeyBtn = page.getByRole('button', { name: /подключение|ключ|key/i }).first();
    await expect(apiKeyBtn).toBeVisible();
    await apiKeyBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, '08_api_key_modal.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Step 09: Publish Listing Modal
    const publishBtn = page.getByRole('button', { name: /подать объявление|publish/i }).first();
    await expect(publishBtn).toBeVisible();
    await publishBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, '09_publish_modal.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Step 10: About Modal
    const aboutBtn = page.getByRole('button', { name: /о проекте|about/i }).first();
    if (await aboutBtn.isVisible()) {
      await aboutBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(screenshotsDir, '10_about_modal.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    // Step 11: Rooms Hub Tab
    const roomsTab = page.getByRole('button', { name: /комнаты|rooms/i }).first();
    await expect(roomsTab).toBeVisible();
    await roomsTab.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, '11_tab_rooms_hub.png') });

    // Step 12: AI Angel Chat Tab
    const chatTab = page.getByRole('button', { name: /чат|chat/i }).first();
    await expect(chatTab).toBeVisible();
    await chatTab.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, '12_tab_angel_chat.png') });

    // Step 13: MCP Console Tab
    const mcpTab = page.getByRole('button', { name: /mcp/i }).first();
    if (await mcpTab.isVisible()) {
      await mcpTab.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(screenshotsDir, '13_tab_mcp_console.png') });
    }

    // Step 14: Principles Tab
    const principlesTab = page.getByRole('button', { name: /принципы|principles/i }).first();
    if (await principlesTab.isVisible()) {
      await principlesTab.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(screenshotsDir, '14_tab_principles.png') });
    }

    // Step 15: Return Home via Logo
    const logoBtn = page.getByRole('button', { name: /на главную|go to marketplace/i }).first();
    await expect(logoBtn).toBeVisible();
    await logoBtn.click();
    await page.waitForTimeout(300);

    // Step 16: Open Listing Detail Modal
    const firstCardTitle = page.locator('article h2, article h3').first();
    if (await firstCardTitle.isVisible()) {
      await firstCardTitle.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(screenshotsDir, '15_listing_detail.png') });

      // In Detail: Return Back via Breadcrumb
      const backBtn = page.getByRole('button', { name: /каталог|← назад/i }).first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // Step 17: Theme Toggle (Dark / Light)
    const themeBtn = page.getByRole('button', { name: /тема|theme/i }).first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(screenshotsDir, '16_theme_toggled.png') });
      await themeBtn.click(); // Toggle back
    }

    // Step 18: Language Toggle (RU / EN)
    const langBtn = page.getByRole('button', { name: /ru|en/i }).first();
    if (await langBtn.isVisible()) {
      await langBtn.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(screenshotsDir, '17_lang_english.png') });
      await langBtn.click(); // Toggle back
    }
  });
});
