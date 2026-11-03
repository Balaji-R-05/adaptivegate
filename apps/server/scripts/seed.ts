/**
 * Dev-only seed script — not part of the product. Creates a test API key and
 * a servers row (pointing at the fixture downstream server by default) for
 * an already-signed-in Supabase user, ahead of the dashboard's Connect/
 * Servers pages (build-order step 4) existing to do this for real.
 *
 * Usage: pnpm --filter @adaptivegate/server run seed -- <email> [downstream-url]
 */
import { randomBytes } from 'node:crypto';
import { apiKeys, db, servers, users } from '@adaptivegate/db';
import { eq } from 'drizzle-orm';
import { hashApiKey } from '../src/auth/apiKey';

async function main() {
  const [
    email,
    downstreamUrl = `http://localhost:${process.env.FIXTURE_DOWNSTREAM_PORT ?? 3100}/mcp`,
  ] = process.argv.slice(2);

  if (!email) {
    console.error('Usage: pnpm --filter @adaptivegate/server run seed -- <email> [downstream-url]');
    process.exit(1);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.error(
      `No user found for ${email}. Sign in to the dashboard with GitHub first (Milestone 2) so Supabase Auth creates the row.`,
    );
    process.exit(1);
  }

  const rawKey = `ag_${randomBytes(24).toString('hex')}`;

  await db.insert(apiKeys).values({
    userId: user.id,
    hashedKey: hashApiKey(rawKey),
    label: 'dev seed',
  });

  await db.insert(servers).values({
    userId: user.id,
    name: 'fixture',
    url: downstreamUrl,
    auth: { type: 'none' },
  });

  console.log(`Seeded a server (${downstreamUrl}) and an API key for ${email}.`);
  console.log(`API key (shown once, store it now): ${rawKey}`);
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
