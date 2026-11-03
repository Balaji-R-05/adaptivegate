import { createHash } from 'node:crypto';
import { apiKeys, db } from '@adaptivegate/db';
import { and, eq, isNull } from 'drizzle-orm';

// API keys are high-entropy random tokens, not user-chosen passwords, so a
// fast cryptographic hash is the right tool here (not bcrypt/argon2).
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export interface VerifiedApiKey {
  userId: string;
}

// Fails closed: any lookup miss, revoked key, or error returns null, never a
// bypass (see CLAUDE.md's "default to fail closed" convention).
export async function verifyApiKey(rawKey: string): Promise<VerifiedApiKey | null> {
  const hashedKey = hashApiKey(rawKey);

  const [row] = await db
    .select({ userId: apiKeys.userId })
    .from(apiKeys)
    .where(and(eq(apiKeys.hashedKey, hashedKey), isNull(apiKeys.revokedAt)))
    .limit(1);

  return row ? { userId: row.userId } : null;
}
