/**
 * A self-hosted Supabase stack has no dashboard to generate the anon/
 * service-role keys for you, so this makes them instead - they're just
 * JWTs signed with your own JWT_SECRET. Prints both so you can paste them
 * into .env. Signs the JWT by hand (no `jsonwebtoken` package) since it's
 * only a few lines and this script only runs once per deployment.
 *
 * Usage: pnpm --filter @adaptivegate/server run generate-supabase-keys -- <JWT_SECRET>
 */
import { createHmac } from 'node:crypto';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function signHS256(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerPart = base64url(JSON.stringify(header));
  const payloadPart = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(`${headerPart}.${payloadPart}`).digest('base64url');
  return `${headerPart}.${payloadPart}.${signature}`;
}

function main() {
  // pnpm passes the "--" separator through as an argument too, so filter
  // it out instead of just grabbing a fixed position.
  const secret = process.argv.slice(2).filter((arg) => arg !== '--')[0];
  if (!secret) {
    console.error('Usage: pnpm --filter @adaptivegate/server run generate-supabase-keys -- <JWT_SECRET>');
    process.exit(1);
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  // 10-year expiry - these are long-lived keys for your own stack, not
  // short-lived user session tokens.
  const expiresAt = issuedAt + 10 * 365 * 24 * 60 * 60;

  const anonKey = signHS256({ role: 'anon', iss: 'supabase', iat: issuedAt, exp: expiresAt }, secret);
  const serviceRoleKey = signHS256(
    { role: 'service_role', iss: 'supabase', iat: issuedAt, exp: expiresAt },
    secret,
  );

  // Only SUPABASE_ANON_KEY is needed - the dashboard fetches it at runtime
  // from the server's /api/config, so there's no separate browser copy to set.
  console.log('Paste these into .env:\n');
  console.log(`SUPABASE_ANON_KEY=${anonKey}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`);
}

main();
