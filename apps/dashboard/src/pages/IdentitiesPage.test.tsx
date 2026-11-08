import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchMock, renderPage } from '../test/testUtils';
import { IdentitiesPage } from './IdentitiesPage';

vi.mock('../lib/supabase', () => ({
  getSupabase: vi.fn(async () => ({ auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } })),
}));

beforeEach(() => {
  installFetchMock();
});

describe('IdentitiesPage', () => {
  it('renders without crashing and shows the page heading', async () => {
    renderPage(<IdentitiesPage />);
    expect(await screen.findByRole('heading', { name: 'Agent Identities & Quotas' })).toBeInTheDocument();
  });

  it('offers an Edit limits button once a real identity exists', async () => {
    const realFetch = global.fetch;
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/identities')) {
        return new Response(
          JSON.stringify([
            {
              id: '11111111-1111-1111-1111-111111111111',
              userId: '22222222-2222-2222-2222-222222222222',
              name: 'coding-agent',
              serverScope: null,
              budgetLimit: null,
              policyId: null,
              enabled: true,
              createdAt: new Date().toISOString(),
              usedToday: 3,
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return realFetch(input);
    }) as typeof fetch;

    renderPage(<IdentitiesPage />);
    expect(await screen.findByRole('button', { name: /Edit limits/ })).toBeInTheDocument();
  });
});
