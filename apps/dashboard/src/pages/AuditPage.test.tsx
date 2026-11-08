import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchMock, renderPage } from '../test/testUtils';
import { AuditPage } from './AuditPage';

vi.mock('../lib/supabase', () => ({
  getSupabase: vi.fn(async () => ({ auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } })),
}));

beforeEach(() => {
  installFetchMock();
});

describe('AuditPage', () => {
  it('renders without crashing and shows the page heading', async () => {
    renderPage(<AuditPage />);
    expect(await screen.findByRole('heading', { name: 'Cryptographic Audit Trail' })).toBeInTheDocument();
  });

  it('prompts to verify before any check has run', async () => {
    renderPage(<AuditPage />);
    // The <p> is wrapped in a childless <div>, so an unscoped text query
    // would also match that wrapper — restrict the match to <p> elements.
    expect(
      await screen.findByText(/Click Verify Chain to recompute every event's hash/, { selector: 'p' }),
    ).toBeInTheDocument();
  });
});
