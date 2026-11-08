import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchMock, renderPage } from '../test/testUtils';
import { OverviewPage } from './OverviewPage';

vi.mock('../lib/supabase', () => ({
  getSupabase: vi.fn(async () => ({ auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } })),
}));

beforeEach(() => {
  installFetchMock();
});

describe('OverviewPage', () => {
  it('renders without crashing and shows the page heading', async () => {
    renderPage(<OverviewPage />);
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no events', async () => {
    renderPage(<OverviewPage />);
    expect(await screen.findByText('No events yet.')).toBeInTheDocument();
  });
});
