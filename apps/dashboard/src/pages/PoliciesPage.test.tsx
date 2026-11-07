import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchMock, renderPage } from '../test/testUtils';
import { PoliciesPage } from './PoliciesPage';

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));

beforeEach(() => {
  installFetchMock();
});

describe('PoliciesPage', () => {
  it('renders without crashing and shows the page heading', async () => {
    renderPage(<PoliciesPage />);
    expect(await screen.findByRole('heading', { name: 'Governance & Security Policies' })).toBeInTheDocument();
  });
});
