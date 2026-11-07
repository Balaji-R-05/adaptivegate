import { and, count, eq, gte, sql } from 'drizzle-orm';
import { db, events } from '@adaptivegate/db';
import { evaluateBudget, type BudgetVerdict } from '@adaptivegate/governance';

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Counts today's non-blocked tool_call events for one identity and runs the
// pure evaluateBudget against it. The DB query is the only side-effecting
// part — the actual allow/deny decision is the same deterministic function
// used by the unit tests.
export async function checkBudget(
  userId: string,
  identityId: string,
  limit: number | null,
): Promise<BudgetVerdict> {
  if (limit === null) {
    return evaluateBudget(0, null);
  }

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

  return evaluateBudget(row?.used ?? 0, limit);
}
