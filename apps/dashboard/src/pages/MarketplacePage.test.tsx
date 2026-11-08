import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchMock, renderPage } from '../test/testUtils';
import { MarketplacePage } from './MarketplacePage';

vi.mock('../lib/supabase', () => ({
  getSupabase: vi.fn(async () => ({ auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } })),
}));

beforeEach(() => {
  installFetchMock();
});

describe('MarketplacePage', () => {
  it('renders without crashing and shows the page heading', async () => {
    renderPage(<MarketplacePage />);
    expect(await screen.findByRole('heading', { name: 'MCP Server Marketplace' })).toBeInTheDocument();
  });

  it('lists every catalog entry as addable when nothing is connected yet', async () => {
    renderPage(<MarketplacePage />);
    // One real catalog entry, picked because its name is unambiguous. Each
    // card's name is an <h3> wrapped in a childless <div>, so a plain
    // findByText would also match that wrapper — query by heading instead.
    expect(await screen.findByRole('heading', { name: 'github', level: 3 })).toBeInTheDocument();
    expect(screen.getAllByText('Add').length).toBeGreaterThan(0);
  });
});
