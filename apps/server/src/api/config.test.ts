import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';

describe('GET /api/config', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalPublicUrl = process.env.SUPABASE_PUBLIC_URL;
  const originalKey = process.env.SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key-value';
    delete process.env.SUPABASE_PUBLIC_URL;
  });

  afterEach(() => {
    process.env.SUPABASE_URL = originalUrl;
    process.env.SUPABASE_PUBLIC_URL = originalPublicUrl;
    process.env.SUPABASE_ANON_KEY = originalKey;
  });

  it('is reachable without an Authorization header', async () => {
    const res = await app.request('/api/config');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key-value',
    });
  });

  it('prefers SUPABASE_PUBLIC_URL over SUPABASE_URL when both are set (server-container vs. browser address differ)', async () => {
    process.env.SUPABASE_PUBLIC_URL = 'http://localhost:8000';
    const res = await app.request('/api/config');
    const body = (await res.json()) as { supabaseUrl: string };
    expect(body.supabaseUrl).toBe('http://localhost:8000');
  });

  it('fails closed (500, not a broken/empty response) if SUPABASE_URL is not set', async () => {
    delete process.env.SUPABASE_URL;
    const res = await app.request('/api/config');
    expect(res.status).toBe(500);
  });
});
