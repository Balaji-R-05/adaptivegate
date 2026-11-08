import { Hono } from 'hono';

// Public, no login required — the dashboard needs this before anyone signs
// in, to find out which Supabase project to use. This way one dashboard
// build works for every deployer, instead of baking a specific Supabase
// project's URL/key into the JS bundle at build time.
export const configRouter = new Hono();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

configRouter.get('/', (c) => {
  return c.json({
    // SUPABASE_URL is what this server uses internally to reach Supabase.
    // When running in Docker, that can be an internal address
    // (http://gateway:8000) the browser can't reach. SUPABASE_PUBLIC_URL
    // lets us give the browser a different, reachable address in that case;
    // it's optional and just falls back to SUPABASE_URL otherwise.
    supabaseUrl: process.env.SUPABASE_PUBLIC_URL || requireEnv('SUPABASE_URL'),
    supabaseAnonKey: requireEnv('SUPABASE_ANON_KEY'),
  });
});
