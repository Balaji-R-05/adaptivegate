import { expect, test } from '@playwright/test';

test('dashboard loads and shows the heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AdaptiveGate Dashboard' })).toBeVisible();
});
