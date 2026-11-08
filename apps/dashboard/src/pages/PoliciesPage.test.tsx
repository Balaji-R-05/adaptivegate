import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchMock, renderPage } from '../test/testUtils';
import { PoliciesPage } from './PoliciesPage';

vi.mock('../lib/supabase', () => ({
  getSupabase: vi.fn(async () => ({ auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } })),
}));

beforeEach(() => {
  installFetchMock();
});

describe('PoliciesPage', () => {
  it('renders without crashing and shows the page heading', async () => {
    renderPage(<PoliciesPage />);
    expect(await screen.findByRole('heading', { name: 'Governance & Security Policies' })).toBeInTheDocument();
  });

  it('offers the curated policy packs once the create form is opened', async () => {
    renderPage(<PoliciesPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Add Policy Pack/ }));
    expect(await screen.findByRole('button', { name: /safe-coding-agent/ })).toBeInTheDocument();
  });

  it('sorts and renders real policy rows whose createdAt is a JSON string, not a Date', async () => {
    // Regression test: apiClient.get() (apps/dashboard/src/lib/apiClient.ts) never runs the
    // response through Zod, so createdAt is a raw ISO string at runtime even though the shared
    // Policy type claims Date (z.coerce.date() only coerces when something actually parses it).
    // Sorting/formatting it as a real Date crashed in production (b.createdAt.getTime is not a
    // function) because installFetchMock's default policies response is an empty array, which
    // never exercises the sort at all.
    const realFetch = global.fetch;
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/policies')) {
        return new Response(
          JSON.stringify([
            {
              id: '11111111-1111-1111-1111-111111111111',
              userId: '22222222-2222-2222-2222-222222222222',
              name: 'older-pack',
              version: 1,
              yaml: 'version: 1\nrules: []\n',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
            {
              id: '33333333-3333-3333-3333-333333333333',
              userId: '22222222-2222-2222-2222-222222222222',
              name: 'newer-pack',
              version: 2,
              yaml: 'version: 1\nrules: []\n',
              createdAt: '2026-06-01T00:00:00.000Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return realFetch(input);
    }) as typeof fetch;

    renderPage(<PoliciesPage />);
    // The newest policy is auto-expanded (it's the default), so its name
    // appears twice (card title + the expanded YAML preview's own label) —
    // findAllByText rather than findByText, same ambiguous-match shape
    // fixed earlier in AuditPage.test.tsx/MarketplacePage.test.tsx.
    expect((await screen.findAllByText('newer-pack')).length).toBeGreaterThan(0);
    expect(await screen.findByText('older-pack')).toBeInTheDocument();
  });

  it('opens a delete confirmation and sends DELETE on confirm', async () => {
    const deleteCalls: Array<{ url: string; body: unknown }> = [];
    const realFetch = global.fetch;
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/policies/') && init?.method === 'DELETE') {
        deleteCalls.push({ url, body: init.body ? JSON.parse(init.body as string) : undefined });
        return new Response(null, { status: 204 });
      }
      if (url.includes('/api/policies')) {
        return new Response(
          JSON.stringify([
            {
              id: '11111111-1111-1111-1111-111111111111',
              userId: '22222222-2222-2222-2222-222222222222',
              name: 'solo-pack',
              version: 1,
              yaml: 'version: 1\nrules: []\n',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return realFetch(input);
    }) as typeof fetch;

    renderPage(<PoliciesPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Delete solo-pack/ }));
    expect(await screen.findByRole('heading', { name: 'Delete solo-pack?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Delete Policy/ }));

    await waitFor(() => expect(deleteCalls).toHaveLength(1));
    expect(deleteCalls[0]?.url).toContain('/api/policies/11111111-1111-1111-1111-111111111111');
    expect(deleteCalls[0]?.body).toEqual({ reassignPolicyId: null });
  });
});
