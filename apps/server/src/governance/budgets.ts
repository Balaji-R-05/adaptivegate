import { and, count, eq, gte, sql } from 'drizzle-orm';
import { db, events } from '@adaptivegate/db';
import { evaluateBudget, type BudgetVerdict } from '@adaptivegate/governance';

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Today's non-blocked tool_call count for one identity — the one
// side-effecting query shared by checkBudget (below) and the Identities/
// Overview pages, which display it even when there's no budget limit set.
export async function countCallsToday(userId: string, identityId: string): Promise<number> {
  const [row] = await db
    .select({ used: count() })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.type, 'tool_call'),
        gte(events.createdAt, startOfToday()),
        sql`${events.payload}->>'identityId' = ${identityId}`,
        sql`${events.payload}->>'blocked' = 'false'`,
      ),
    );
  return row?.used ?? 0;
}

// Runs the pure evaluateBudget against today's usage — the DB query is the
// only side-effecting part, the allow/deny decision itself is the same
// deterministic function used by the unit tests.
export async function checkBudget(
  userId: string,
  identityId: string,
  limit: number | null,
): Promise<BudgetVerdict> {
  if (limit === null) {
    return evaluateBudget(0, null);
  }
  const used = await countCallsToday(userId, identityId);
  return evaluateBudget(used, limit);
}
