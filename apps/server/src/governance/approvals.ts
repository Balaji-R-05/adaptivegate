import { and, eq, gt, isNull } from 'drizzle-orm';
import { approvals, db } from '@adaptivegate/db';
import { isApprovalExpired } from '@adaptivegate/governance';

const APPROVAL_TTL_MS = 15 * 60 * 1000;

interface ApprovalKey {
  userId: string;
  identityId: string | null;
  tool: string;
  serverId: string;
}

function matchesIdentity(identityId: string | null) {
  return identityId ? eq(approvals.identityId, identityId) : isNull(approvals.identityId);
}

// An approved, not-yet-consumed, not-yet-expired approval unblocks exactly
// one retried call — this marks it consumed so it can't be reused.
export async function findUnconsumedApproval(key: ApprovalKey): Promise<boolean> {
  const [row] = await db
    .select({ id: approvals.id, expiresAt: approvals.expiresAt })
    .from(approvals)
    .where(
      and(
        eq(approvals.userId, key.userId),
        matchesIdentity(key.identityId),
        eq(approvals.tool, key.tool),
        eq(approvals.serverId, key.serverId),
        eq(approvals.status, 'approved'),
        isNull(approvals.consumedAt),
      ),
    )
    .limit(1);

  if (!row || isApprovalExpired(row.expiresAt, new Date())) {
    return false;
  }

  await db.update(approvals).set({ consumedAt: new Date() }).where(eq(approvals.id, row.id));
  return true;
}

// Creates one pending approval per distinct (identity, tool, server) in
// flight at a time — repeated blocked calls for the same thing don't flood
// the approvals queue with duplicates.
export async function findOrCreatePendingApproval(
  key: ApprovalKey,
  argumentsRedacted: Record<string, unknown> | undefined,
  ruleName: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: approvals.id, expiresAt: approvals.expiresAt })
    .from(approvals)
    .where(
      and(
        eq(approvals.userId, key.userId),
        matchesIdentity(key.identityId),
        eq(approvals.tool, key.tool),
        eq(approvals.serverId, key.serverId),
        eq(approvals.status, 'pending'),
        gt(approvals.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (existing) return;

  await db.insert(approvals).values({
    userId: key.userId,
    identityId: key.identityId,
    tool: key.tool,
    serverId: key.serverId,
    argumentsRedacted: argumentsRedacted ?? null,
    ruleName,
    status: 'pending',
    expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
  });
}
