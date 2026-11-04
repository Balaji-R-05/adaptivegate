/**
 * Dev-only script — not part of the product. Creates a policy for an
 * already-signed-in user, ahead of the dashboard's Policies page existing.
 * "Latest wins" (see src/governance/policyEngine.ts) — running this again
 * just adds a newer row that becomes the active one.
 *
 * Usage: pnpm --filter @adaptivegate/server run create-policy -- <email> [path-to-policy.yaml]
 *
 * With no path, creates a permissive "allow everything" policy — needed
 * right after Milestone 6 ships, since call_tool now denies by default with
 * no policy configured at all.
 */
import { readFileSync } from 'node:fs';
import { db, policies, users } from '@adaptivegate/db';
import { parsePolicyDocument } from '@adaptivegate/governance';
import { eq } from 'drizzle-orm';

const DEFAULT_YAML = `version: 1
rules:
  - name: allow-everything
    match:
      tool: "*"
    action: allow
`;

async function main() {
  const [email, policyPath] = process.argv.slice(2);
  if (!email) {
    console.error(
      'Usage: pnpm --filter @adaptivegate/server run create-policy -- <email> [path-to-policy.yaml]',
    );
    process.exit(1);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.error(`No user found for ${email}.`);
    process.exit(1);
  }

  const yaml = policyPath ? readFileSync(policyPath, 'utf8') : DEFAULT_YAML;
  parsePolicyDocument(yaml); // throws if invalid — fail fast before inserting

  await db.insert(policies).values({
    userId: user.id,
    name: policyPath ?? 'allow-everything (dev default)',
    version: 1,
    yaml,
  });

  console.log(`Created a policy for ${email}:\n${yaml}`);
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
