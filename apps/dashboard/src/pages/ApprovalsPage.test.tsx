import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchMock, renderPage } from '../test/testUtils';
import { ApprovalsPage } from './ApprovalsPage';

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));

beforeEach(() => {
  installFetchMock();
});

describe('ApprovalsPage', () => {
  it('renders without crashing and shows the page heading', async () => {
    renderPage(<ApprovalsPage />);
    expect(await screen.findByRole('heading', { name: 'Human-in-the-Loop Approvals' })).toBeInTheDocument();
  });

  it('renders a real pending approval whose dates are JSON strings, not Date objects', async () => {
    // Regression test: apiClient.get() never runs responses through Zod, so
    // expiresAt/createdAt/decidedAt are raw ISO strings at runtime even
    // though the shared Approval type claims Date (z.coerce.date() only
    // coerces when something actually parses it) — crashed for real with
    // "approval.expiresAt.getTime is not a function" because
    // installFetchMock's default approvals response is an empty array,
    // which never exercises any date arithmetic at all.
    const realFetch = global.fetch;
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/approvals')) {
        return new Response(
          JSON.stringify([
            {
              id: '11111111-1111-1111-1111-111111111111',
              userId: '22222222-2222-2222-2222-222222222222',
              identityId: null,
              tool: 'microsoft_code_sample_search',
              serverId: '33333333-3333-3333-3333-333333333333',
              argumentsRedacted: null,
              ruleName: 'approve-drops',
              status: 'pending',
              decidedAt: null,
              consumedAt: null,
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
              createdAt: new Date().toISOString(),
              isExpired: false,
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return realFetch(input);
    }) as typeof fetch;

    renderPage(<ApprovalsPage />);
    expect(await screen.findByText('microsoft_code_sample_search')).toBeInTheDocument();
    expect(await screen.findByText(/Expires in/)).toBeInTheDocument();
  });
});
