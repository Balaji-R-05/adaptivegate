import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;

interface RuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

// We fetch Supabase's URL/anon key from the server at runtime instead of
// reading them from a build-time env var, so one dashboard build works for
// every Supabase project. Fetched once and cached - later calls just reuse
// the same client instead of fetching or creating a new one again.
let clientPromise: Promise<SupabaseClient> | undefined;

async function initSupabase(): Promise<SupabaseClient> {
  const res = await fetch(`${GATEWAY_URL}/api/config`);
  if (!res.ok) {
    throw new Error(`failed to load Supabase config from the gateway: ${res.status}`);
  }
  const config = (await res.json()) as RuntimeConfig;
  return createClient(config.supabaseUrl, config.supabaseAnonKey);
}

export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = initSupabase();
  }
  return clientPromise;
}
