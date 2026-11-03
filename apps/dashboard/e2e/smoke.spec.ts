import { expect, test } from '@playwright/test';

test('signed-out visitors see the landing page with a GitHub sign-in button', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Route, recover, and govern every MCP tool call.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with GitHub' })).toBeVisible();
});
