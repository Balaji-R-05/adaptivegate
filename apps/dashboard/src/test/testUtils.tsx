import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

// Smoke-test harness: renders a page the same way the real app does
// (QueryClientProvider + router context) without needing a real backend or
// Supabase session. `retry: false` so a failed request fails the test
// immediately instead of retrying for several seconds.
export function renderPage(ui: ReactNode): RenderResult {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

// URL-aware fetch mock covering the REST API's actual response shapes
// (array list endpoints vs. the two object-shaped ones) — good enough for a
// page to render its empty/zero state without crashing on malformed data,
// not a full backend simulation.
export function installFetchMock() {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    let body: unknown = [];
    if (url.includes('/api/events/stats')) {
      body = {
        total: 0,
        byType: { tool_call: 0, policy_decision: 0, recovery_attempt: 0, approval_decision: 0 },
        blocked: 0,
        recovered: 0,
      };
    } else if (url.includes('/api/events/verify')) {
      body = { valid: true, eventCount: 0, brokenCount: 0, firstBrokenEventId: null, firstBrokenEventAt: null };
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}
