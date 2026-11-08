import { z } from 'zod';

export const eventTypeSchema = z.enum([
  'tool_call',
  'policy_decision',
  'recovery_attempt',
  'approval_decision',
]);

export type EventType = z.infer<typeof eventTypeSchema>;

// `payload` is the per-type detail (tool name/args, policy verdict, recovery
// attempt outcome, etc.); secrets/PII must already be redacted by the time an
// event reaches this shape — the audit log is append-only, so nothing
// written here can be scrubbed after the fact.
export const eventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: eventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  // Part of the hash chain (packages/core/governance/src/audit/hashChain.ts)
  // — the Audit page displays these, but nothing should recompute a hash
  // client-side; GET /api/events/verify is the only source of truth for
  // whether the chain is intact.
  hash: z.string(),
  previousHash: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export type Event = z.infer<typeof eventSchema>;

// Query params for GET /api/events — all optional, same validate-at-the-
// boundary convention as the rest of packages/shared.
export const listEventsQuerySchema = z.object({
  type: eventTypeSchema.optional(),
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

export const eventStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  byType: z.record(eventTypeSchema, z.number().int().nonnegative()),
  blocked: z.number().int().nonnegative(),
  recovered: z.number().int().nonnegative(),
});

export type EventStats = z.infer<typeof eventStatsSchema>;
