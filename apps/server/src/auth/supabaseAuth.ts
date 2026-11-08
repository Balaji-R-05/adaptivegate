import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Context, Next } from 'hono';
import { isEmailAllowed } from './allowlist';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

let adminClient: SupabaseClient | undefined;

function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
  }
  return adminClient;
}

interface SupabaseUser {
  userId: string;
  email: string;
}

// Verifies a dashboard session token against Supabase (a network call, not
// local JWT/JWKS verification — simpler, and we don't have to manage signing
// keys ourselves). Factored out so tests can mock it, same pattern as
// verifyApiKey for the /mcp gateway's auth.
export async function verifySupabaseToken(token: string): Promise<SupabaseUser | null> {
  const { data, error } = await getAdminClient().auth.getUser(token);
  if (error || !data.user || !data.user.email) {
    return null;
  }
  return { userId: data.user.id, email: data.user.email };
}

// Dashboard requests to /api/* authenticate via the user's Supabase session,
// not an AdaptiveGate API key (that's the /mcp gateway's separate scheme).
// A valid session isn't enough on its own — Supabase would happily let
// anyone sign up, so the allowlist check is what actually keeps hosted mode
// invite-only.
export async function requireUser(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!token) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const user = await verifySupabaseToken(token);
  if (!user) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  if (!isEmailAllowed(user.email)) {
    return c.json({ error: 'not invited' }, 403);
  }

  c.set('userId', user.userId);
  await next();
}
