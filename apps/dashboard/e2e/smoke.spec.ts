import { expect, test } from '@playwright/test';

test('signed-out dashboard shows the GitHub sign-in button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AdaptiveGate Dashboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with GitHub' })).toBeVisible();
});
