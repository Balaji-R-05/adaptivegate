import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getSupabase', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('fetches runtime config from the gateway and builds a client from it, not build-time env vars', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon-key' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { getSupabase } = await import('./supabase');
    const client = await getSupabase();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/config');
    expect(client).toBeDefined();
    expect(typeof client.auth.getSession).toBe('function');
  });

  it('only fetches once, even when called concurrently', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon-key' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { getSupabase } = await import('./supabase');
    const [a, b] = await Promise.all([getSupabase(), getSupabase()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('rejects if the gateway responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );

    const { getSupabase } = await import('./supabase');
    await expect(getSupabase()).rejects.toThrow('failed to load Supabase config');
  });
});
