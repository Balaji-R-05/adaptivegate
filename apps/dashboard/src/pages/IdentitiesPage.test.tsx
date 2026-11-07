import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchMock, renderPage } from '../test/testUtils';
import { IdentitiesPage } from './IdentitiesPage';

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));

beforeEach(() => {
  installFetchMock();
});

describe('IdentitiesPage', () => {
  it('renders without crashing and shows the page heading', async () => {
    renderPage(<IdentitiesPage />);
    expect(await screen.findByRole('heading', { name: 'Agent Identities & Quotas' })).toBeInTheDocument();
  });
});
