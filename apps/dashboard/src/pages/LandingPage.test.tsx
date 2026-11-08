import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../test/testUtils';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('renders without crashing and shows the sign-in call to action', () => {
    renderPage(
      <LandingPage onSignIn={vi.fn()} onEmailSignIn={vi.fn()} onEmailSignUp={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument();
  });

  it('submits email/password to onEmailSignIn by default', async () => {
    const onEmailSignIn = vi.fn().mockResolvedValue(undefined);
    renderPage(
      <LandingPage onSignIn={vi.fn()} onEmailSignIn={onEmailSignIn} onEmailSignUp={vi.fn()} />,
    );

    const form = screen.getByLabelText(/email/i).closest('form') as HTMLFormElement;
    fireEvent.change(within(form).getByLabelText(/email/i), { target: { value: 'friend@example.com' } });
    fireEvent.change(within(form).getByLabelText(/password/i), { target: { value: 'hunter2' } });
    fireEvent.click(within(form).getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(onEmailSignIn).toHaveBeenCalledWith('friend@example.com', 'hunter2');
    });
  });

  it('switches to create-account mode and submits to onEmailSignUp, surfacing an error on failure', async () => {
    const onEmailSignUp = vi.fn().mockResolvedValue('User already registered');
    renderPage(
      <LandingPage onSignIn={vi.fn()} onEmailSignIn={vi.fn()} onEmailSignUp={onEmailSignUp} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /need an account/i }));
    const form = screen.getByLabelText(/email/i).closest('form') as HTMLFormElement;
    fireEvent.change(within(form).getByLabelText(/email/i), { target: { value: 'friend@example.com' } });
    fireEvent.change(within(form).getByLabelText(/password/i), { target: { value: 'hunter2' } });
    fireEvent.click(within(form).getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(onEmailSignUp).toHaveBeenCalledWith('friend@example.com', 'hunter2');
    });
    expect(await screen.findByText(/user already registered/i)).toBeInTheDocument();
  });
});
