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

// For call sites that record several events in one request (call_tool
// records policy_decision then tool_call, sometimes recovery_attempt too).
// recordEvent always re-SELECTs the chain's current tip, which is wasted
// work on every call after the first within one invocation — this fetches
// the tip once and chains subsequent records from the hash it just computed
// locally, cutting one DB round trip (a real, measured cost against this
// project's remote-hosted Postgres — see docs/evaluation.md) per extra
// event. Events within one recorder are still written strictly
// sequentially, so this doesn't change recordEvent's own documented
// concurrent-invocations race — that's about separate call_tool calls
// racing each other, not about events within a single one.
export function createEventRecorder(userId: string) {
  let previousHash: string | null | undefined; // undefined = not fetched yet

  return {
    async record(type: EventType, payload: Record<string, unknown>): Promise<void> {
      try {
        if (previousHash === undefined) {
          const [row] = await db
            .select({ hash: events.hash })
            .from(events)
            .where(eq(events.userId, userId))
            .orderBy(desc(events.createdAt))
            .limit(1);
          previousHash = row?.hash ?? null;
        }

        const createdAt = new Date();
        const hash = computeEventHash(previousHash, {
          userId,
          type,
          payload,
          createdAt: createdAt.toISOString(),
        });

        await db.insert(events).values({ userId, type, payload, createdAt, hash, previousHash });
        previousHash = hash;
      } catch (error) {
        console.error('failed to record audit event', error);
      }
    },
  };
}
