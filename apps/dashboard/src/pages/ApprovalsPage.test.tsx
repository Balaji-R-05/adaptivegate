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
});
