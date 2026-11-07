import { createHash } from 'node:crypto';
import { apiKeys, db, identities } from '@adaptivegate/db';
import { and, eq, isNull } from 'drizzle-orm';

// API keys are high-entropy random tokens, not user-chosen passwords, so a
// fast cryptographic hash is the right tool here (not bcrypt/argon2).
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export interface VerifiedIdentity {
  id: string;
  serverScope: string[] | null;
  budgetLimit: number | null;
  policyId: string | null;
  enabled: boolean;
}

export interface VerifiedApiKey {
  userId: string;
  // undefined = a plain, unrestricted user-level key (today's only kind) —
  // see packages/db's `identities` table.
  identity?: VerifiedIdentity;
}

// Fails closed: any lookup miss, revoked key, or error returns null, never a
// bypass (see CLAUDE.md's "default to fail closed" convention).
export async function verifyApiKey(rawKey: string): Promise<VerifiedApiKey | null> {
  const hashedKey = hashApiKey(rawKey);

  const [row] = await db
    .select({
      userId: apiKeys.userId,
      identityId: identities.id,
      serverScope: identities.serverScope,
      budgetLimit: identities.budgetLimit,
      policyId: identities.policyId,
      enabled: identities.enabled,
    })
    .from(apiKeys)
    .leftJoin(identities, eq(apiKeys.identityId, identities.id))
    .where(and(eq(apiKeys.hashedKey, hashedKey), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!row) return null;

  if (!row.identityId) {
    return { userId: row.userId };
  }

  return {
    userId: row.userId,
    identity: {
      id: row.identityId,
      serverScope: row.serverScope,
      budgetLimit: row.budgetLimit,
      policyId: row.policyId,
      enabled: row.enabled ?? true,
    },
  };
}
