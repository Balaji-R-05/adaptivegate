import { fireEvent, screen } from '@testing-library/react';
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

  it('offers the curated policy packs once the create form is opened', async () => {
    renderPage(<PoliciesPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Add Policy Pack/ }));
    expect(await screen.findByRole('button', { name: /safe-coding-agent/ })).toBeInTheDocument();
  });
});
