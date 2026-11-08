import { expect, test } from '@playwright/test';

test('signed-out visitors see the landing page with a GitHub sign-in button', async ({ page }) => {
  // This e2e run only starts the dashboard (see playwright.config.ts), not
  // the backend server, so /api/config (which the app fetches before it can
  // render anything - see lib/supabase.ts) has nothing real to reach. Fake
  // response, since this test only needs the page to render, not real auth.
  await page.route('**/api/config', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ supabaseUrl: 'http://localhost:54321', supabaseAnonKey: 'test-anon-key' }),
    }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Route, recover, and govern every MCP tool call.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with GitHub' })).toBeVisible();
});
