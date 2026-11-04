import { db, events } from '@adaptivegate/db';
import { computeEventHash } from '@adaptivegate/governance';
import { desc, eq } from 'drizzle-orm';

export type EventType = 'tool_call' | 'policy_decision' | 'recovery_attempt' | 'approval_decision';

interface RecordEventParams {
  userId: string;
  type: EventType;
  payload: Record<string, unknown>;
}

// Best-effort: a write failure here is logged, not thrown — it does not
// block the call it's trying to record. Known gaps, stated rather than
// hidden: this is a select-then-insert, not a transaction, so concurrent
// calls from the same user could race and corrupt the chain; and losing an
// audit write currently doesn't roll back the action it describes. Both are
// fine at this project's scale, not fine at real production scale.
export async function recordEvent(params: RecordEventParams): Promise<void> {
  try {
    const [previous] = await db
      .select({ hash: events.hash })
      .from(events)
      .where(eq(events.userId, params.userId))
      .orderBy(desc(events.createdAt))
      .limit(1);

    const createdAt = new Date();
    const previousHash = previous?.hash ?? null;
    const hash = computeEventHash(previousHash, {
      userId: params.userId,
      type: params.type,
      payload: params.payload,
      createdAt: createdAt.toISOString(),
    });

    await db.insert(events).values({
      userId: params.userId,
      type: params.type,
      payload: params.payload,
      createdAt,
      hash,
      previousHash,
    });
  } catch (error) {
    console.error('failed to record audit event', error);
  }
}
