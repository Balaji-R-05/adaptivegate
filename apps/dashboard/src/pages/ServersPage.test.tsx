import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchMock, renderPage } from '../test/testUtils';
import { ServersPage } from './ServersPage';

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));

beforeEach(() => {
  installFetchMock();
});

describe('ServersPage', () => {
  it('renders without crashing and shows the page heading', async () => {
    renderPage(<ServersPage />);
    expect(await screen.findByRole('heading', { name: 'Connected MCP Servers' })).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no servers', async () => {
    renderPage(<ServersPage />);
    expect(await screen.findByText('No servers yet.')).toBeInTheDocument();
  });
});
