import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../test/testUtils';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('renders without crashing and shows the sign-in call to action', () => {
    renderPage(<LandingPage onSignIn={vi.fn()} />);
    expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument();
  });
});
