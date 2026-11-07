import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchMock, renderPage } from '../test/testUtils';
import { ConnectPage } from './ConnectPage';

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));

beforeEach(() => {
  installFetchMock();
});

describe('ConnectPage', () => {
  it('renders without crashing and shows the page heading', async () => {
    renderPage(<ConnectPage />);
    expect(await screen.findByRole('heading', { name: 'Connect AI Agents' })).toBeInTheDocument();
  });
});
