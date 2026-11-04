import { db, events } from '@adaptivegate/db';
import { eventTypeSchema, listEventsQuerySchema, type EventStats } from '@adaptivegate/shared';
import { and, count, desc, eq, lt, sql } from 'drizzle-orm';
import { Hono } from 'hono';

export const eventsRouter = new Hono();

// Read-only: nothing here writes to `events` — see
// src/governance/auditLog.ts for the only place that's allowed to.
eventsRouter.get('/', async (c) => {
  const userId = c.get('userId');

  const parsed = listEventsQuerySchema.safeParse({
    type: c.req.query('type'),
    before: c.req.query('before'),
    limit: c.req.query('limit'),
  });
  if (!parsed.success) {
    return c.json({ error: 'invalid query', issues: parsed.error.issues }, 400);
  }
  const { type, before, limit } = parsed.data;

  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        type ? eq(events.type, type) : undefined,
        before ? lt(events.createdAt, before) : undefined,
      ),
    )
    .orderBy(desc(events.createdAt))
    .limit(limit);

  return c.json(rows);
});

eventsRouter.get('/stats', async (c) => {
  const userId = c.get('userId');

  const byTypeRows = await db
    .select({ type: events.type, count: count() })
    .from(events)
    .where(eq(events.userId, userId))
    .groupBy(events.type);

  const byType = Object.fromEntries(
    eventTypeSchema.options.map((eventType) => [eventType, 0]),
  ) as Record<string, number>;
  let total = 0;
  for (const row of byTypeRows) {
    byType[row.type] = row.count;
    total += row.count;
  }

  // jsonb predicates rather than pulling rows into Node — these booleans
  // only ever appear on tool_call payloads, but matching on the field alone
  // (not also the type) is harmless since no other event type sets it.
  const [blockedRow] = await db
    .select({ blocked: count() })
    .from(events)
    .where(and(eq(events.userId, userId), sql`${events.payload}->>'blocked' = 'true'`));

  const [recoveredRow] = await db
    .select({ recovered: count() })
    .from(events)
    .where(and(eq(events.userId, userId), sql`${events.payload}->>'recovered' = 'true'`));

  const blocked = blockedRow?.blocked ?? 0;
  const recovered = recoveredRow?.recovered ?? 0;

  const stats: EventStats = { total, byType: byType as EventStats['byType'], blocked, recovered };
  return c.json(stats);
});
