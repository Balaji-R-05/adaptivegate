import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mockUser: { id: string; email?: string } | null = null;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve(
          mockUser ? { data: { user: mockUser }, error: null } : { data: { user: null }, error: new Error('invalid') },
        ),
    },
  }),
}));

const { requireUser } = await import('./supabaseAuth');

function buildApp() {
  const app = new Hono();
  app.use('*', requireUser);
  app.get('/', (c) => c.json({ userId: c.get('userId') }));
  return app;
}

describe('requireUser', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  afterEach(() => {
    mockUser = null;
    delete process.env.ALLOWED_EMAILS;
  });

  it('rejects a request with no token', async () => {
    const res = await buildApp().request('/');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    mockUser = null;
    const res = await buildApp().request('/', { headers: { Authorization: 'Bearer bad-token' } });
    expect(res.status).toBe(401);
  });

  it('allows a valid session when no allowlist is set', async () => {
    mockUser = { id: 'user-1', email: 'anyone@example.com' };
    const res = await buildApp().request('/', { headers: { Authorization: 'Bearer good-token' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'user-1' });
  });

  it('rejects a valid session whose email is not on the allowlist', async () => {
    process.env.ALLOWED_EMAILS = 'invited@example.com';
    mockUser = { id: 'user-1', email: 'stranger@example.com' };
    const res = await buildApp().request('/', { headers: { Authorization: 'Bearer good-token' } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'not invited' });
  });

  it('allows a valid session whose email is on the allowlist', async () => {
    process.env.ALLOWED_EMAILS = 'invited@example.com';
    mockUser = { id: 'user-1', email: 'invited@example.com' };
    const res = await buildApp().request('/', { headers: { Authorization: 'Bearer good-token' } });
    expect(res.status).toBe(200);
  });
});
